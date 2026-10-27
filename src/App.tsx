import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { MagicalShield, ShieldVariant } from './components/Shield';

class EMA {
  value: number | null = null;
  alpha: number;
  constructor(alpha = 0.4) { this.alpha = alpha; }
  update(newValue: number) {
    if (this.value === null) {
      this.value = newValue;
    } else {
      this.value = this.alpha * newValue + (1 - this.alpha) * this.value;
    }
    return this.value;
  }
  reset() { this.value = null; }
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shieldRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variant, setVariant] = useState<ShieldVariant>('eldritch');
  const [trackingData, setTrackingData] = useState({ rotX: 0, rotY: 0, dist: 0 });

  // Store EMA instances
  const emAs = useRef({
    x: new EMA(0.4),
    y: new EMA(0.4),
    scale: new EMA(0.3),
    rotX: new EMA(0.2),
    rotY: new EMA(0.2)
  });

  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let animationFrameId: number;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2,
        });

        setIsModelLoaded(true);
        startCamera();
      } catch (err) {
        console.error("Error loading MediaPipe:", err);
        setError("Failed to load hand tracking model.");
      }
    }

    async function startCamera() {
      if (!videoRef.current) return;
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadeddata", predictWebcam);
      } catch (err: any) {
        console.error("Webcam error:", err);
        setError(err?.message || "Please allow webcam access to use this AR app.");
      }
    }

    let lastVideoTime = -1;
    function predictWebcam() {
      const video = videoRef.current;
      const shield = shieldRef.current;
      const container = containerRef.current;
      if (!video || !shield || !handLandmarker || !container) return;

      const rect = container.getBoundingClientRect();
      const containerAspect = rect.width / rect.height;
      const videoAspect = video.videoWidth / video.videoHeight;
      
      let renderWidth = rect.width;
      let renderHeight = rect.height;
      let offsetX = 0;
      let offsetY = 0;

      if (containerAspect > videoAspect) {
        // Container wider - video cropped Top/Bottom
        renderHeight = rect.width / videoAspect;
        offsetY = (rect.height - renderHeight) / 2;
      } else {
        // Container taller - video cropped Left/Right
        renderWidth = rect.height * videoAspect;
        offsetX = (rect.width - renderWidth) / 2;
      }

      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        
        const results = handLandmarker.detectForVideo(video, performance.now());
        
        if (results.landmarks && results.landmarks.length > 0) {
          // We just track the first hand for the shield
          const landmarks = results.landmarks[0];
          const handedness = results.handedness[0][0].categoryName; // "Left" or "Right"
          
          const wrist = landmarks[0];
          const indexMCP = landmarks[5];
          const middleMCP = landmarks[9];
          const middleTip = landmarks[12];
          const pinkyMCP = landmarks[17];

          // We mirror the X coordinate because the video is mirrored via CSS scaleX(-1)
          const mirrorX = (rawX: number) => 1.0 - rawX;

          const mIndexX = mirrorX(indexMCP.x);
          const mPinkyX = mirrorX(pinkyMCP.x);

          // Trigger logic: Is palm facing camera?
          let isPalmFacingCamera = false;
          if (handedness === 'Right') {
            isPalmFacingCamera = mIndexX < mPinkyX;
          } else {
            isPalmFacingCamera = mIndexX > mPinkyX;
          }

          if (isPalmFacingCamera) {
            // Distance calculation using pixel coordinates for accuracy
            const rawDx = (wrist.x - middleTip.x) * video.videoWidth;
            const rawDy = (wrist.y - middleTip.y) * video.videoHeight;
            const rawDistance = Math.sqrt(rawDx * rawDx + rawDy * rawDy);

            // Scale factor proportional to distance (tune K)
            const baseShieldSize = 256; // size of shield div
            const K = 2.0;
            const targetScale = (rawDistance * K) / baseShieldSize;

            // Target mapping (Palm Center) correctly mapped to the container inner size and crop
            const targetPixelX = offsetX + mirrorX(middleMCP.x) * renderWidth;
            const targetPixelY = offsetY + middleMCP.y * renderHeight;

            // 3D Tilt calculation (simplified mapping from depth `z` values)
            // If middle is pushed back (positive Z relative to wrist), tilt back (negative X rot)
            const targetRotX = middleMCP.z * -1500; 
            // If pinky is closer than index, tilt Y
            const handednessMultiplier = handedness === 'Right' ? -1 : 1;
            const targetRotY = (indexMCP.z - pinkyMCP.z) * 1500 * handednessMultiplier;

            // Apply EMA smoothing
            const finalX = emAs.current.x.update(targetPixelX);
            const finalY = emAs.current.y.update(targetPixelY);
            const finalScale = emAs.current.scale.update(targetScale);
            const finalRotX = emAs.current.rotX.update(targetRotX);
            const finalRotY = emAs.current.rotY.update(targetRotY);

            // Update state periodically for UI (not every frame to avoid excessive React renders)
            if (Math.random() < 0.1) {
              setTrackingData({ rotX: Math.round(finalRotX), rotY: Math.round(finalRotY), dist: Math.round(rawDistance) });
            }

            // Directly modify dom node for 60fps performance without react overhead
            shield.style.opacity = '1';
            shield.style.transform = `translate(${finalX - baseShieldSize/2}px, ${finalY - baseShieldSize/2}px) scale(${finalScale}) rotateX(${finalRotX}deg) rotateY(${finalRotY}deg)`;
          } else {
            // Palm closed or back of hand -> hide shield slowly or instantly
            shield.style.opacity = '0';
            emAs.current.x.reset();
            emAs.current.y.reset();
            emAs.current.scale.reset();
            emAs.current.rotX.reset();
            emAs.current.rotY.reset();
          }
        } else {
          // No hand detected
          shield.style.opacity = '0';
          emAs.current.x.reset();
          emAs.current.y.reset();
          emAs.current.scale.reset();
          emAs.current.rotX.reset();
          emAs.current.rotY.reset();
        }
      }

      animationFrameId = requestAnimationFrame(predictWebcam);
    }

    init();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (handLandmarker) handLandmarker.close();
    };
  }, []);

  return (
    <div className="w-screen h-screen bg-[#080808] text-[#F0E6D2] font-sans flex flex-col overflow-hidden select-none">
      {/* Top Navigation / Branding */}
      <header className="flex justify-between items-end px-6 md:px-12 py-6 md:py-8 border-b border-[#F0E6D2]/10 shrink-0">
        <div className="flex flex-col">
          <span className="text-[10px] tracking-[0.4em] uppercase opacity-60 mb-2 font-semibold">Technical Series 04: Augmented Realities</span>
          <h1 className="text-4xl md:text-6xl font-serif italic font-light tracking-tighter">Sorcerer Supreme</h1>
        </div>
        <div className="hidden md:flex gap-8 text-[11px] uppercase tracking-widest pb-2 opacity-80">
          <span>OpenCV & MediaPipe</span>
          <span>Vol. 012</span>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 grid grid-cols-12 gap-0 overflow-hidden relative">
        {/* Sidebar: Technical Specs */}
        <aside className="col-span-3 border-r border-[#F0E6D2]/10 p-8 flex-col justify-between hidden lg:flex">
          <div>
            <h2 className="text-[11px] uppercase tracking-widest font-bold text-orange-500 mb-6">Logic Flow</h2>
            <ul className="space-y-6">
              <li>
                <div className="text-2xl font-serif italic mb-1">01. Input</div>
                <p className="text-xs leading-relaxed opacity-60 uppercase tracking-wide">640x480 RAW RGB STREAMS VIA WEBCAM_0</p>
              </li>
              <li>
                <div className="text-2xl font-serif italic mb-1">02. Tracking</div>
                <p className="text-xs leading-relaxed opacity-60 uppercase tracking-wide">MEDIAPIPE HAND-MESH (21 LANDMARKS)</p>
              </li>
              <li>
                <div className="text-2xl font-serif italic mb-1">03. Vector</div>
                <p className="text-xs leading-relaxed opacity-60 uppercase tracking-wide">NORMAL VECTOR CALCULATION FOR PALM ORIENTATION</p>
              </li>
              <li>
                <div className="text-2xl font-serif italic mb-1">04. Render</div>
                <p className="text-xs leading-relaxed opacity-60 uppercase tracking-wide">ELDRI_SHIELD.PNG ROTATION + DYNAMIC SCALING</p>
              </li>
            </ul>
          </div>
          
          <div className="bg-orange-950/20 p-4 border border-orange-500/20 rounded-sm">
            <p className="text-[10px] uppercase tracking-tighter leading-tight">
              <span className="text-orange-400 block mb-1 font-bold italic">Expert Note:</span>
              Interpolate scale using a weighted moving average (α=0.7) to eliminate micro-jitter in the shield projection.
            </p>
          </div>
        </aside>

        {/* Central Viewport: AR Preview Mockup */}
        <section className="col-span-12 lg:col-span-6 bg-[#0E0E0E] relative p-6 md:p-12 flex flex-col items-center justify-center">
          <div 
            ref={containerRef}
            className="absolute top-6 left-6 right-6 bottom-6 md:top-12 md:left-12 md:right-12 md:bottom-12 border border-[#F0E6D2]/5 flex items-center justify-center overflow-hidden"
          >
            {error ? (
              <div className="z-20 max-w-sm text-center p-6 bg-red-900/10 rounded-lg border border-red-500/30 flex flex-col items-center">
                <h2 className="text-lg font-serif italic mb-2 text-red-400">Camera Access Required</h2>
                <p className="text-xs opacity-70 tracking-wide leading-relaxed mb-4 text-center">{error}</p>
                <p className="text-[10px] opacity-50 tracking-widest text-[#F0E6D2] mb-4 text-center">If you denied access, you may need to update your browser settings and reload.</p>
                <button 
                  onClick={() => window.location.reload()} 
                  className="px-6 py-2 border border-red-500/50 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] uppercase tracking-widest transition-colors cursor-pointer"
                >
                  Retry Initializing
                </button>
              </div>
            ) : (
              <>
                {/* Mockup Video Feed Background (seen while loading) */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 opacity-40"></div>
                
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
                />
                
                <div
                  ref={shieldRef}
                  className="absolute top-0 left-0 w-64 h-64 origin-center transition-opacity duration-300 ease-out z-10 opacity-0 will-change-transform preserve-3d"
                >
                  <MagicalShield variant={variant} />
                </div>
                
                {!isModelLoaded && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#080808]/80 backdrop-blur-md border border-[#F0E6D2]/10">
                    <div className="w-16 h-16 border border-orange-500/50 border-t-orange-500 rounded-full animate-spin mb-6"></div>
                    <h1 className="text-xs font-medium tracking-[0.3em] text-orange-500 uppercase mb-2">Conjuring Superpowers</h1>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Loading MediaPipe Models...</p>
                  </div>
                )}
              </>
            )}

            {/* UI Indicators Overlay */}
            {isModelLoaded && !error && (
              <div className="absolute top-4 left-4 font-mono text-[9px] text-green-400/80 pointer-events-none z-20 space-y-1">
                <div>TRACKING_ACTIVE: {trackingData.dist > 0 ? "TRUE" : "FALSE"}</div>
                <div>PALM_NORMAL_TILT: [{trackingData.rotX}°, {trackingData.rotY}°]</div>
                <div>DIST_0_12: {trackingData.dist}px</div>
              </div>
            )}
          </div>
          
          {/* Floating Title Overlay */}
          <div className="absolute bottom-10 right-10 md:bottom-16 md:right-16 text-right z-30 pointer-events-none drop-shadow-xl">
            <div className="text-[10px] uppercase tracking-[0.3em] opacity-40 mb-2">Resonance</div>
            <div className={`text-3xl md:text-4xl font-serif italic ${
              variant === 'eldritch' ? 'text-orange-500' : 
              variant === 'crimson' ? 'text-red-500' :
              variant === 'emerald' ? 'text-green-500' : 'text-cyan-500'
            } transition-colors duration-500 drop-shadow-md`}>
              {isModelLoaded && !error ? variant.toUpperCase() : "Booting..."}
            </div>
          </div>
        </section>

        {/* Right Sidebar: Assets & Formulas */}
        <aside className="col-span-3 p-8 border-l border-[#F0E6D2]/10 bg-[#0A0A0A] hidden lg:block overflow-y-auto">
          
          <div className="mb-10 pt-2 border-t border-[#F0E6D2]/10">
            <h3 className="text-[11px] uppercase tracking-widest font-bold mb-4 opacity-70">Resonance Type</h3>
            <div className="flex flex-col gap-2">
              {(['eldritch', 'crimson', 'emerald', 'azure'] as ShieldVariant[]).map(v => {
                const getColors = (type: ShieldVariant) => {
                  switch(type) {
                    case 'eldritch': return 'border-orange-500 text-orange-500 bg-orange-500/10';
                    case 'crimson': return 'border-red-500 text-red-500 bg-red-500/10';
                    case 'emerald': return 'border-green-500 text-green-500 bg-green-500/10';
                    case 'azure': return 'border-cyan-500 text-cyan-500 bg-cyan-500/10';
                  }
                };
                return (
                  <button 
                    key={v}
                    onClick={() => setVariant(v)}
                    className={`text-left text-[10px] px-4 py-3 uppercase tracking-widest border transition-all duration-300 ${
                      variant === v ? getColors(v) : 'border-[#F0E6D2]/10 opacity-50 hover:opacity-100 hover:border-[#F0E6D2]/30'
                    }`}
                  >
                    {v} Schema
                  </button>
                )
              })}
            </div>
          </div>

           <div className="mb-10">
            <h3 className="text-[11px] uppercase tracking-widest font-bold mb-4 opacity-50">Formulaic Insight</h3>
            <div className="bg-[#111] p-4 font-serif text-lg leading-loose border-l-2 border-orange-500">
              d = √((x₁₂ - x₀)² + (y₁₂ - y₀)²)
              <br/>
              <span className="text-orange-500">Scale = k ⋅ d</span>
            </div>
            <p className="mt-4 text-[10px] opacity-50 italic">Where constant (k) defines the ratio between pixel distance and display radius.</p>
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="text-[11px] uppercase tracking-widest font-bold mb-3 opacity-50">Asset Prompt</h3>
              <p className="text-[11px] font-serif leading-relaxed italic border-t border-[#F0E6D2]/10 pt-3">
                "A glowing, intricate magical mandala design, eldritch energy, circular geometric patterns, sparks and gold-orange light, transparent background, symmetrical, VFX asset."
              </p>
            </div>

            <div className="pt-6 border-t border-[#F0E6D2]/10">
              <h3 className="text-[11px] uppercase tracking-widest font-bold mb-3 opacity-50">Perf. Matrix</h3>
              <div className="flex justify-between items-end mb-2">
                <span className="text-[10px] uppercase opacity-40">MediaPipe Lite</span>
                <span className="text-[10px] font-mono">{isModelLoaded ? "Active" : "..."}</span>
              </div>
              <div className="w-full h-1 bg-[#1A1A1A]">
                <div className={`h-full bg-orange-500 transition-all duration-1000 ${isModelLoaded ? 'w-3/4' : 'w-0'}`}></div>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Footer Bar */}
      <footer className="flex justify-between items-center px-6 md:px-12 py-4 md:py-6 border-t border-[#F0E6D2]/10 text-[9px] md:text-[10px] tracking-widest uppercase shrink-0">
        <div className="flex gap-6 md:gap-12">
          <span className="opacity-40">Revision // 0.8.2</span>
          <span className="opacity-40 font-bold tracking-[0.2em] md:tracking-[0.4em]">Confidential / AI Research Dept</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${isModelLoaded ? 'bg-red-600 animate-pulse' : 'bg-gray-600'}`}></span>
          <span>{isModelLoaded ? 'Live Computation Active' : 'Initializing'}</span>
        </div>
      </footer>
    </div>
  );
}


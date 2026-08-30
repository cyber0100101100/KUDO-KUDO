import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import * as faceapi from '@vladmandic/face-api';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

export default function FaceEnrollmentScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setVideoStream] = useState<MediaStream | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [descriptors, setDescriptors] = useState<Float32Array[]>([]);
  const [poseValid, setPoseValid] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);

  const steps = [
    { id: 1, label: 'الوجه الأمامي' },
    { id: 2, label: 'الاتجاه إلى اليمين' },
    { id: 3, label: 'الاتجاه إلى اليسار' },
    { id: 4, label: 'النظر إلى الأعلى' },
    { id: 5, label: 'النظر إلى الأسفل' },
  ];

  useEffect(() => {
    loadModels();
    startCamera();
    return () => stopCamera();
  }, []);

  // Automated detection loop
  useEffect(() => {
    let intervalId: any;
    
    const runDetection = async () => {
      if (!modelsLoaded || !stream || loading || processingRef.current || currentStep > 5) return;
      
      try {
        processingRef.current = true;
        const detection = await faceapi
          .detectSingleFace(videoRef.current!)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          const isCorrectPose = validatePose(detection.landmarks);
          if (isCorrectPose) {
            // Found valid pose, capture it
            const newDescriptors = [...descriptors, detection.descriptor];
            setDescriptors(newDescriptors);
            setError(null);
            
            if (currentStep < 5) {
              setCurrentStep(prev => prev + 1);
            } else {
              await completeEnrollment(newDescriptors);
            }
          }
        } else {
          setPoseValid(false);
        }
      } catch (err) {
        console.error('Detection loop error:', err);
      } finally {
        processingRef.current = false;
      }
    };

    if (modelsLoaded && stream && !loading && currentStep <= 5) {
      intervalId = setInterval(runDetection, 300); // Faster check for smoother experience
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [modelsLoaded, stream, loading, currentStep, descriptors]);

  const loadModels = async () => {
    try {
      setLoading(true);
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      setModelsLoaded(true);
    } catch (err) {
      console.error('Error loading face models:', err);
      setError('خطأ في تحميل محرك التعرف على الوجه. تأكد من اتصال الإنترنت.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(console.error);
      };
    }
  }, [stream]);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      setVideoStream(s);
    } catch (err) {
      setError('نحتاج إلى الوصول إلى الكاميرا للتحقق من هويتك.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }
  };

  const validatePose = (landmarks: faceapi.FaceLandmarks68) => {
    const nose = landmarks.getNose()[6]; // Tip
    const jaw = landmarks.getJawOutline();
    const jawLeft = jaw[0];
    const jawRight = jaw[16];
    const noseBridge = landmarks.getNose()[0];
    const chin = jaw[8];

    const jawWidth = jawRight.x - jawLeft.x;
    const nosePos = (nose.x - jawLeft.x) / jawWidth;

    const faceHeight = chin.y - noseBridge.y;
    const noseVerticalPos = (nose.y - noseBridge.y) / faceHeight;

    let isValid = false;
    switch (currentStep) {
      case 1: // Front
        isValid = nosePos > 0.42 && nosePos < 0.58 && noseVerticalPos > 0.35 && noseVerticalPos < 0.65;
        break;
      case 2: // Right (User turns to their right)
        isValid = nosePos < 0.35; 
        break;
      case 3: // Left (User turns to their left)
        isValid = nosePos > 0.65;
        break;
      case 4: // Up
        isValid = noseVerticalPos < 0.3; 
        break;
      case 5: // Down
        isValid = noseVerticalPos > 0.7;
        break;
    }
    setPoseValid(isValid);
    return isValid;
  };

  const getPoseHint = () => {
    if (poseValid) return 'تم! ابق ثابتًا...';
    switch (currentStep) {
      case 1: return 'ضع وجهك في المنتصف';
      case 2: return 'أدر وجهك ببطء نحو اليمين';
      case 3: return 'أدر وجهك ببطء نحو اليسار';
      case 4: return 'انظر قليلاً نحو الأعلى';
      case 5: return 'انظر قليلاً نحو الأسفل';
      default: return 'جاري التحقق...';
    }
  };

  const completeEnrollment = async (finalDescriptors: Float32Array[]) => {
    setLoading(true);
    try {
      if (user && finalDescriptors.length > 0) {
        // Average the descriptors for a robust embedding
        const descriptorLength = finalDescriptors[0].length;
        const avgDescriptor = new Float32Array(descriptorLength);
        
        for (let i = 0; i < descriptorLength; i++) {
          let sum = 0;
          for (const d of finalDescriptors) {
            sum += d[i];
          }
          avgDescriptor[i] = sum / finalDescriptors.length;
        }
        
        await updateDoc(doc(db, 'users', user.uid), {
          enrollmentComplete: true,
          faceEmbedding: Array.from(avgDescriptor)
        });
        navigate('/employee/home');
      }
    } catch (err) {
      console.error('Enrollment error:', err);
      setError('حدث خطأ أثناء حفظ البيانات في قاعدة البيانات.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 text-slate-800 min-h-screen flex flex-col font-sans">
      <div className="w-full bg-white min-h-screen relative flex flex-col">
        <header className="bg-white/90 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-50 border-b border-slate-100/50 shadow-sm">
          <button onClick={() => navigate('/employee/home')} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 transition-all active:scale-95">
            <span className="material-symbols-outlined text-xl">arrow_forward</span>
          </button>
          <h1 className="text-base font-black text-slate-900 tracking-tight">إعداد بصمة الوجه</h1>
          <div className="w-9"></div>
        </header>

        <main className="flex-1 flex flex-col p-6 pb-32 max-w-2xl mx-auto w-full">
          <div className="w-full flex justify-center mb-10">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-lg border border-slate-50 flex items-center justify-center">
              <img alt="KUDO Logo" className="h-10 w-auto object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBoGgSNGhdMLpQ2C5v6Jp3NxcRlZc4D9tKntgy6K_TUwwUsvoZTh_Gm_92I03yMOtVXLB4a05Btsma6JgrC_FLRp9Qp6LqpnhtSSLMN6RkdVv5610MQpGkySxlPQVnaKGhkRClEFaaAXoffQJ309MfB3555EI8sOU89APs6_KuMit6P5jidaz9QT4O-KV6eYqhJPNNyM7FHffRmo8cGHshA1a3DVzxmLwMZnsBzYj9Y2g4GvQoLvP7PJNZQORmCoLobLUw" />
            </div>
          </div>

            <div className="relative w-64 h-64 md:w-80 md:h-80 mx-auto mb-10 flex items-center justify-center">
              <div className="absolute inset-0 bg-red-50/50 rounded-full blur-2xl animate-pulse"></div>
              <div className="relative w-full h-full rounded-full border-4 border-slate-100 flex flex-col items-center justify-center bg-white shadow-xl z-10 overflow-hidden">
              {stream ? (
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              ) : (
                <div className="flex flex-col items-center gap-4 text-slate-300">
                  <span className="material-symbols-outlined text-7xl filled-icon">face</span>
                  <p className="text-xs font-bold uppercase tracking-widest">{loading && !modelsLoaded ? 'جاري تحميل المحرك...' : 'تجهيز الكاميرا'}</p>
                </div>
              )}
              {loading && <div className="absolute top-0 left-0 w-full h-1 bg-[#E31E24] shadow-[0_0_10px_rgba(227,30,36,0.8)] animate-[scan_3s_ease-in-out_infinite]"></div>}
            </div>
            <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-[#E31E24] rounded-tr-3xl translate-x-2 -translate-y-2 z-20"></div>
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-[#E31E24] rounded-tl-3xl -translate-x-2 -translate-y-2 z-20"></div>
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-[#E31E24] rounded-br-3xl translate-x-2 translate-y-2 z-20"></div>
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-[#E31E24] rounded-bl-3xl -translate-x-2 translate-y-2 z-20"></div>
          </div>

          <div className="bg-white rounded-[32px] p-6 md:p-8 border border-slate-50 shadow-sm mb-10">
            <h2 className="text-[10px] font-black mb-6 text-slate-400 text-center uppercase tracking-[0.3em] opacity-60">خطوات التحقق</h2>
            <div className="flex flex-col gap-3">
              {steps.map((step) => (
                <div 
                  key={step.id}
                  className={`flex items-center gap-4 p-3.5 rounded-2xl transition-all ${currentStep === step.id ? 'bg-slate-50 border border-slate-100' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-black text-[10px] ${currentStep >= step.id ? 'bg-[#E31E24] text-white shadow-lg shadow-red-100' : 'bg-slate-200 text-slate-400'}`}>
                    {currentStep > step.id ? (
                      <span className="material-symbols-outlined text-sm">check</span>
                    ) : (
                      step.id
                    )}
                  </div>
                  <span className={`text-xs flex-1 ${currentStep === step.id ? 'text-slate-900 font-black tracking-tight' : 'text-slate-400 font-bold'}`}>
                    {step.label}
                  </span>
                  {currentStep === step.id && (
                    <div className="w-2 h-2 rounded-full bg-[#E31E24] animate-ping"></div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto">
            {error && <p className="bg-red-50 text-[#E31E24] p-4 rounded-2xl text-center mb-6 font-bold text-sm border border-red-100">{error}</p>}
            <div 
              className={`w-full py-5 flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all ${poseValid ? 'bg-green-500 text-white shadow-green-100' : 'bg-slate-100 text-slate-400'}`}
            >
              {!modelsLoaded ? (
                'جاري تحميل المحرك...'
              ) : loading ? (
                'جاري الحفظ...'
              ) : (
                <>
                  <span className="material-symbols-outlined animate-spin">sync</span>
                  {poseValid ? 'تم التعرف! جاري الانتقال...' : 'جاري المسح التلقائي...'}
                </>
              )}
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-4 font-bold uppercase tracking-widest opacity-60">
              {getPoseHint()}
            </p>
          </div>
        </main>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}


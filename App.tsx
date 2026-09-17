import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import InfoForm from './components/InfoForm';
import CaptureScreen from './components/CaptureScreen';
import ArchiveScreen from './components/ArchiveScreen';
import LoginScreen from './components/LoginScreen';
import SnapshotModal from './components/SnapshotModal';
import { AppState, InspectionInfo, DefectItem, Snapshot, PhotoItem } from './types';
import { generatePDF, getMatchingStandard } from './services/pdfService';
import { 
  loadStep, loadInfo, loadDefects, loadLocations, 
  saveStep, saveInfo, saveDefects, saveLocations, clearAllData, saveToArchive, checkAuth, clearAuth, updateAuthTimestamp 
} from './services/storage';
import { ArrowLeft, FileText, Download, MapPin, Loader2, Archive, Copy, CheckCircle, RotateCcw, Wifi, WifiOff, LogOut, History, Image as ImageIcon } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import PhotoViewer from './components/PhotoViewer';

const getLocalISOString = () => {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  const coeff = 1000 * 60 * 10;
  const rounded = new Date(Math.round(now.getTime() / coeff) * coeff);
  return (new Date(rounded.getTime() - offsetMs)).toISOString().slice(0, 16);
};

const INITIAL_INFO: InspectionInfo = {
  apartmentName: '',
  unit: '',
  typeSize: '',
  inspectorName: '',
  phoneNumber: '',
  date: getLocalISOString()
};

const DEFAULT_LOCATIONS = [
  '현관', '현관창고', '공용욕실', '침실3', '침실2', '복도', 
  '펜트리', '거실', '주방', '다용도실', '침실1', '발코니', 
  '실외기실', '대피공간', '드레스룸', '부부욕실', '공기질,라돈'
];

const getPhotoUrl = (item: PhotoItem): string => (typeof item === 'string' ? item : item.url);

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [step, setStep] = useState<AppState['step']>('info');
  const [lastStep, setLastStep] = useState<AppState['step']>('info');
  const [info, setInfo] = useState<InspectionInfo>(INITIAL_INFO);
  const [defects, setDefects] = useState<DefectItem[]>([]);
  const [locations, setLocations] = useState<string[]>(DEFAULT_LOCATIONS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [viewerState, setViewerState] = useState<{
    isOpen: boolean;
    photos: string[];
    index: number;
  }>({ isOpen: false, photos: [], index: 0 });
  
  const isLoadedRef = useRef(false);

  useEffect(() => {
    const initApp = async () => {
      try {
        const hasAuth = checkAuth();
        setIsAuthorized(hasAuth);
        const [savedStep, savedInfo, savedDefects, savedLocations] = await Promise.all([
          loadStep(), loadInfo(), loadDefects(), loadLocations()
        ]);
        if (savedStep) setStep(savedStep);
        if (savedInfo) setInfo(savedInfo);
        if (savedDefects) setDefects(savedDefects);
        if (savedLocations) setLocations(savedLocations);
      } catch (error) {
        console.error("Failed to load saved data", error);
      } finally {
        setIsLoading(false);
        isLoadedRef.current = true;
      }
    };
    initApp();
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!checkAuth()) setIsAuthorized(false);
        else setIsAuthorized(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;
    const handleUserActivity = () => {
      if (!checkAuth()) {
        setIsAuthorized(false);
        clearAuth(); 
      } else {
        updateAuthTimestamp();
      }
    };
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    return () => {
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
    };
  }, [isAuthorized]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => { if (isLoadedRef.current) saveStep(step); }, [step]);
  useEffect(() => { if (isLoadedRef.current) saveInfo(info); }, [info]);
  useEffect(() => { if (isLoadedRef.current) saveDefects(defects); }, [defects]);
  useEffect(() => { if (isLoadedRef.current) saveLocations(locations); }, [locations]);

  const handleInfoSubmit = (data: InspectionInfo) => { setInfo(data); setStep('capture'); };
  const handleFinishCapture = () => setStep('preview');

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setTimeout(async () => {
      try { await generatePDF(info, defects, locations); } 
      catch (e) { alert("PDF 생성 중 오류가 발생했습니다."); } 
      finally { setIsGenerating(false); }
    }, 100);
  };

  const generateReportText = () => {
    const dateStr = new Date(info.date).toLocaleString('ko-KR');
    let text = `[사전점검 리포트 - Double Check]\n\n■ 현장 정보\n- 현장명: ${info.apartmentName}\n- 동/호수: ${info.unit}\n- 타입: ${info.typeSize}\n- 고객명: ${info.inspectorName} (${info.phoneNumber})\n- 점검일: ${dateStr}\n\n================================\n\n`;
    const actualDefects = defects.filter(d => d.location !== '공기질,라돈');
    text += `■ 하자 세부 내역 (총 ${actualDefects.length}건)\n\n`;
    
    const grouped = defects.reduce((acc, d) => {
      (acc[d.location] = acc[d.location] || []).push(d);
      return acc;
    }, {} as Record<string, DefectItem[]>);
    
    Object.keys(grouped).forEach(loc => {
      text += `[${loc}]\n`;
      grouped[loc].forEach((d, i) => { text += `${i + 1}. ${d.description}\n`; });
      text += '\n';
    });
    return text;
  };

  const openPhotoViewer = (photos: string[], index: number) => {
    setViewerState({ isOpen: true, photos, index });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500">
        <Loader2 size={40} className="animate-spin text-brand-600 mb-4" />
        <p>데이터 처리 중...</p>
      </div>
    );
  }

  if (!isAuthorized) return <LoginScreen onSuccess={() => setIsAuthorized(true)} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pt-safe relative">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        {!isOnline && (
          <div className="bg-gray-800 text-white text-xs py-2 px-4 text-center">오프라인 모드</div>
        )}
        <div className="px-4 py-3 max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step !== 'info' && step !== 'archive' && (
              <button onClick={() => setStep(step === 'preview' ? 'capture' : 'info')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600">
                <ArrowLeft size={20} />
              </button>
            )}
            <h1 className="font-bold text-gray-800 text-lg flex items-center gap-2">
              <FileText className="text-brand-600" size={24} /> Double Check
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-md mx-auto w-full">
        {step === 'info' && <InfoForm initialData={info} onSubmit={handleInfoSubmit} />}
        {step === 'capture' && (
          <CaptureScreen 
            defects={defects} 
            setDefects={setDefects}
            locations={locations}
            setLocations={setLocations}
            onFinish={handleFinishCapture}
            openPhotoViewer={openPhotoViewer}
          />
        )}
        {step === 'archive' && <ArchiveScreen onLoad={(inf, def, loc) => { setInfo(inf); setDefects(def); setLocations(loc); setStep('preview'); }} onGoBack={() => setStep(lastStep)} onGoHome={() => setStep('info')} />}
      </main>

      <AnimatePresence>
        {viewerState.isOpen && (
          <PhotoViewer photos={viewerState.photos} initialIndex={viewerState.index} onClose={() => setViewerState(p => ({ ...p, isOpen: false }))} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;

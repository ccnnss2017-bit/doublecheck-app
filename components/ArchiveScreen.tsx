import React, { useState, useEffect, useRef } from 'react';
import { CompletedInspection } from '../types';
import { loadArchive, loadArchivedItemDetail, deleteFromArchive, importArchiveData, exportArchiveData } from '../services/storage';
import { Trash2, Download, Upload, CheckSquare, Square, FolderOpen, Loader2 } from 'lucide-react';

interface ArchiveScreenProps {
  onLoad: (info: any, defects: any[], locations: string[]) => void;
  onGoBack: () => void;
  onGoHome: () => void;
}

const ArchiveScreen: React.FC<ArchiveScreenProps> = ({ onLoad, onGoBack, onGoHome }) => {
  const [archives, setArchives] = useState<CompletedInspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchArchive = async () => {
    setIsLoading(true);
    try {
      const data = await loadArchive();
      setArchives(data || []);
    } catch(e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArchive();
  }, []);

  const handleLoad = async (id: string) => {
    if (isSelectionMode) {
      toggleSelection(id);
      return;
    }
    setIsLoading(true);
    try {
      const item = archives.find(a => a.id === id);
      const detail = await loadArchivedItemDetail(id);
      if (item && detail) {
        onLoad(item.info, detail.defects, detail.locations);
      }
    } catch (e) {
      alert("데이터를 불러오는데 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleDeleteSingle = async (id: string, e: React.MouseEvent) => {
     e.stopPropagation();
     if (window.confirm("이 항목을 삭제하시겠습니까?")) {
         setIsProcessing(true);
         await deleteFromArchive(id);
         await fetchArchive();
         setIsProcessing(false);
     }
  };

  // ✨ FIX: 순차적 삭제로 데이터 덮어쓰기(Race condition) 에러 완벽 해결
  const handleBulkDelete = async () => {
     if (selectedIds.length === 0) return;
     if (window.confirm(`선택한 ${selectedIds.length}개의 항목을 완전히 삭제하시겠습니까?`)) {
         setIsProcessing(true);
         // 반드시 for...of 문을 사용해 하나씩 지워야 DB 충돌이 발생하지 않음
         for (const id of selectedIds) {
             await deleteFromArchive(id);
         }
         setSelectedIds([]);
         setIsSelectionMode(false);
         await fetchArchive();
         setIsProcessing(false);
     }
  };

  const handleExport = async () => {
    if (selectedIds.length === 0) return;
    setIsProcessing(true);
    try {
      const jsonString = await exportArchiveData(selectedIds);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DoubleCheck_Archive_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setIsSelectionMode(false);
      setSelectedIds([]);
    } catch (e) {
      alert("내보내기 실패");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const text = await file.text();
      await importArchiveData(text);
      await fetchArchive();
      alert("성공적으로 가져왔습니다.");
    } catch(err) {
      alert("가져오기 실패: 파일 형식을 확인해주세요.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (isLoading || isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Loader2 size={40} className="animate-spin text-brand-600 mb-4" />
        <p className="font-bold">{isProcessing ? '처리 중...' : '보관함 불러오는 중...'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto pb-32 h-full flex flex-col animate-in fade-in">
      <div className="flex items-center justify-between mb-6 px-2">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <FolderOpen className="text-brand-600" /> 점검 완료 보관함
        </h2>
      </div>

      {/* ✨ UI 개선: 처음부터 가져오기, 선택, 삭제 버튼 명확하게 노출 */}
      {!isSelectionMode && (
         <div className="flex gap-2 mb-4 px-2">
            <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-white border border-gray-200 text-gray-700 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-gray-50 flex items-center justify-center gap-2">
               <Upload size={16}/> 가져오기
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
            
            <button onClick={() => setIsSelectionMode(true)} className="flex-1 bg-white border border-gray-200 text-gray-700 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-gray-50 flex items-center justify-center gap-2">
               <CheckSquare size={16}/> 선택
            </button>
            
            <button onClick={() => setIsSelectionMode(true)} className="flex-1 bg-white border border-red-200 text-red-600 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-red-50 flex items-center justify-center gap-2">
               <Trash2 size={16}/> 삭제
            </button>
         </div>
      )}

      {isSelectionMode && (
         <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 mb-4 mx-2 flex justify-between items-center animate-in slide-in-from-top-2">
            <span className="text-brand-700 font-bold text-sm">{selectedIds.length}개 선택됨</span>
            <button onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }} className="text-sm bg-white border border-brand-200 text-brand-700 px-3 py-1 rounded-lg font-bold">
              선택 취소
            </button>
         </div>
      )}

      <div className="space-y-3 px-2 flex-1 overflow-y-auto">
        {archives.length === 0 ? (
          <div className="text-center text-gray-400 py-20 border-2 border-dashed rounded-2xl bg-white/50">
            보관된 점검 내역이 없습니다.
          </div>
        ) : (
          archives.map(item => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <div 
                key={item.id} 
                onClick={() => handleLoad(item.id)}
                className={`bg-white p-4 rounded-2xl shadow-sm border transition-all cursor-pointer relative ${isSelected ? 'border-brand-500 ring-2 ring-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-300'}`}
              >
                {isSelectionMode && (
                   <div className="absolute top-4 right-4">
                     {isSelected ? <CheckSquare size={24} className="text-brand-600" /> : <Square size={24} className="text-gray-300" />}
                   </div>
                )}
                <div className="pr-10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-md font-bold">{new Date(item.savedAt).toLocaleDateString()}</span>
                      <span className="bg-brand-100 text-brand-600 text-xs px-2 py-1 rounded-md font-bold">하자 {item.defectCount}건</span>
                    </div>
                    <h3 className="font-bold text-gray-800 text-lg mb-1 line-clamp-1">{item.info.apartmentName} {item.info.unit}</h3>
                    <p className="text-sm text-gray-500">{item.info.inspectorName} ({item.info.phoneNumber})</p>
                </div>

                {!isSelectionMode && (
                    <button 
                      onClick={(e) => handleDeleteSingle(item.id, e)} 
                      className="absolute bottom-4 right-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    >
                       <Trash2 size={20} />
                    </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {isSelectionMode && (
        <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe bg-white/95 backdrop-blur-md border-t z-10 flex gap-2 max-w-md mx-auto">
           <button 
              onClick={handleExport}
              disabled={selectedIds.length === 0}
              className="flex-1 py-4 bg-brand-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 disabled:bg-gray-400 flex items-center justify-center gap-2"
           >
              <Download size={20}/> 내보내기
           </button>
           <button 
              onClick={handleBulkDelete}
              disabled={selectedIds.length === 0}
              className="flex-1 py-4 bg-red-500 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 disabled:bg-gray-400 flex items-center justify-center gap-2"
           >
              <Trash2 size={20}/> 선택 삭제
           </button>
        </div>
      )}
    </div>
  );
};

export default ArchiveScreen;

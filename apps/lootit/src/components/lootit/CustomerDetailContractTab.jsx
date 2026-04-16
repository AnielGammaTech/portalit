import React from 'react';
import { cn } from '@/lib/utils';
import { CloudUpload } from 'lucide-react';
import ContractCard from './ContractCard';
import UploadProgressCard from './UploadProgressCard';

export default function CustomerDetailContractTab({
  contracts,
  extractingId,
  fileInputRef,
  isDragging,
  isUploading,
  onFileUpload,
  onDragOver,
  onDragLeave,
  onDrop,
  onDownload,
  onDelete,
  onRetryExtract,
}) {
  return (
    <div className="space-y-5">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
        onChange={onFileUpload}
        className="hidden"
      />

      {contracts.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Uploaded Contracts ({contracts.length})
          </h4>
          {contracts.map((c) => (
            <ContractCard
              key={c.id}
              contract={c}
              extractingId={extractingId}
              onDownload={onDownload}
              onDelete={onDelete}
              onRetryExtract={onRetryExtract}
            />
          ))}
        </div>
      )}

      {(isUploading || extractingId) ? (
        <UploadProgressCard
          isUploading={isUploading}
          isExtracting={!!extractingId}
        />
      ) : (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'relative cursor-pointer rounded-xl border-2 border-dashed transition-all group',
            isDragging
              ? 'border-pink-400 bg-pink-50/80'
              : 'border-slate-200 bg-white hover:border-pink-300 hover:bg-pink-50/30'
          )}
        >
          <div className="flex items-center gap-3 py-3 px-4">
            <div className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
              isDragging ? 'bg-pink-500' : 'bg-pink-50 group-hover:bg-pink-100'
            )}>
              <CloudUpload className={cn('w-4 h-4', isDragging ? 'text-white' : 'text-pink-500')} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-700">
                {isDragging ? 'Drop here' : contracts.length > 0 ? 'Upload Revised Contract' : 'Upload MSSP Contract'}
              </p>
              <p className="text-[10px] text-slate-400">
                PDF, DOC, XLSX — <span className="text-pink-500 font-medium">browse</span> or drag & drop
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

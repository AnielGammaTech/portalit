import React from 'react';
import { cn } from '@/lib/utils';
import ContractCard from './ContractCard';
import UploadProgressCard from './UploadProgressCard';
import { CloudUpload } from 'lucide-react';

export default function ContractTab({ contracts, extractingId, fileInputRef, isDragging, uploadPending, onFileUpload, onDragOver, onDragLeave, onDrop, onDownload, onDelete, onRetryExtract }) {
  return (
    <div className="space-y-5">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
        onChange={onFileUpload}
        className="hidden"
      />

      {/* Upload / Analyzing State */}
      {(uploadPending || extractingId) ? (
        <UploadProgressCard
          isUploading={uploadPending}
          isExtracting={!!extractingId}
        />
      ) : (
        /* Drag & Drop Upload Zone */
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 group',
            isDragging
              ? 'border-pink-400 bg-pink-50/80 scale-[1.01]'
              : 'border-slate-200 bg-white hover:border-pink-300 hover:bg-pink-50/30'
          )}
        >
          <div className="flex flex-col items-center justify-center py-8 px-6">
            <div className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300',
              isDragging
                ? 'bg-pink-500 shadow-lg shadow-pink-200'
                : 'bg-gradient-to-br from-pink-100 to-rose-100 group-hover:from-pink-200 group-hover:to-rose-200'
            )}>
              <CloudUpload className={cn(
                'w-7 h-7 transition-all duration-300',
                isDragging ? 'text-white scale-110' : 'text-pink-500'
              )} />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">
              {isDragging ? 'Drop your contract here' : 'Upload MSSP Contract'}
            </p>
            <p className="text-xs text-slate-400 text-center max-w-xs">
              Drag & drop a PDF or <span className="text-pink-500 font-medium">browse files</span> -- we'll automatically extract pricing and line items
            </p>
            <div className="flex items-center gap-3 mt-4">
              {['PDF', 'DOC', 'XLSX'].map((ext) => (
                <span key={ext} className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                  .{ext}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Existing contracts list */}
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
    </div>
  );
}

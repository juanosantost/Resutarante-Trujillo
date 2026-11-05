import React from 'react';
import { Sparkles } from 'lucide-react';

interface LoaderProps {
  message?: string;
  subtext?: string;
  fullScreen?: boolean;
}

export const Loader: React.FC<LoaderProps> = ({
  message = 'Cargando Sistema Colmena...',
  subtext = 'Sincronizando datos en tiempo real...',
  fullScreen = true,
}) => {
  const content = (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#B77900] via-[#D6A21A] to-[#181818] text-[#FFFDF5] shadow-xl shadow-[#B77900]/25 border border-[#D6A21A]/40 mb-4 animate-bounce">
        <span className="font-extrabold text-3xl">⬡</span>
        <Sparkles className="w-4 h-4 absolute top-1 right-1 text-[#FFFDF5] animate-spin" />
      </div>
      <h3 className="text-base font-black tracking-widest text-[#181818] uppercase">
        {message}
      </h3>
      <p className="text-xs text-[#B77900] font-medium mt-1 font-mono">
        {subtext}
      </p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-[#FFFDF5]/90 backdrop-blur-sm flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
};

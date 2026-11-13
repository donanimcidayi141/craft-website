import React from 'react';
import { AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetState = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen bg-[#111113] text-zinc-200 flex flex-col items-center justify-center p-6 font-sans select-none">
          <div className="max-w-md w-full bg-[#18181b] border border-red-500/35 rounded-md p-6 shadow-2xl flex flex-col items-center text-center space-y-4">
            <div className="w-10 h-10 rounded bg-red-500/15 border border-red-500/35 text-red-400 flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>
            <h2 className="text-base font-semibold text-white">Bir Şeyler Ters Gitti</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Uygulama çalışırken beklenmedik bir hata ile karşılaşıldı. Yeniden başlatarak kaldığınız yerden devam edebilirsiniz.
            </p>
            {this.state.error && (
              <div className="w-full bg-[#101013] border border-[#27272d] rounded p-2.5 text-[11px] font-mono text-red-300 text-left overflow-auto max-h-32">
                {this.state.error.toString()}
              </div>
            )}
            <div className="flex gap-2 w-full pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 py-2 px-3 rounded bg-[#0d99ff] hover:bg-[#1fa3ff] text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw size={13} />
                <span>Yeniden Yükle</span>
              </button>
              <button
                onClick={this.handleResetState}
                className="py-2 px-3.5 rounded bg-[#202026] hover:bg-[#282830] border border-[#2f2f38] text-zinc-300 font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={13} />
                <span>Sıfırla</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

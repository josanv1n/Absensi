import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, Send, User, Clock, CheckCircle2, AlertTriangle, RefreshCw, History } from 'lucide-react';

const EMPLOYEES = [
  { id: 'EMP001', name: 'Johan' },
  { id: 'EMP002', name: 'Budi Santoso' },
  { id: 'EMP003', name: 'Siti Aminah' },
  { id: 'EMP004', name: 'Ahmad Fauzi' },
  { id: 'EMP005', name: 'Dewi Lestari' },
  { id: 'EMP006', name: 'Rudi Hartono' },
];

const GAS_URL = import.meta.env.VITE_GAS_URL || "";

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [selectedEmp, setSelectedEmp] = useState('');
  const [shift, setShift] = useState('pagi');
  const [status, setStatus] = useState('HADIR');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fetchHistory = () => {
    if (!GAS_URL) return;
    setIsLoadingHistory(true);
    
    // Menggunakan teknik JSONP untuk menghindari error CORS saat mengambil data
    const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
    
    // Buat fungsi global sementara untuk menerima data dari GAS
    (window as any)[callbackName] = (data: any) => {
      if (data.success) {
        setHistory(data.data);
      } else {
        console.error("Error from GAS:", data.error);
      }
      setIsLoadingHistory(false);
      // Bersihkan script dan fungsi global setelah selesai
      delete (window as any)[callbackName];
      const script = document.getElementById(callbackName);
      if (script) script.remove();
    };

    // Buat tag script untuk memanggil URL GAS dengan parameter callback
    const script = document.createElement('script');
    script.src = `${GAS_URL}?callback=${callbackName}`;
    script.id = callbackName;
    
    // Tangani error jaringan (misalnya offline)
    script.onerror = () => {
      console.error("Failed to load JSONP script");
      setIsLoadingHistory(false);
      delete (window as any)[callbackName];
      script.remove();
    };

    document.body.appendChild(script);
  };

  const startCamera = async () => {
    try {
      setCameraError(null);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } } 
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      if (err.name === 'NotAllowedError' || err.message.includes('Permission denied')) {
        setCameraError("Akses kamera ditolak. Mohon izinkan akses kamera di pengaturan browser Anda.");
      } else if (err.name === 'NotFoundError') {
        setCameraError("Kamera tidak ditemukan pada perangkat ini.");
      } else {
        setCameraError("Gagal mengakses kamera: " + err.message);
      }
    }
  };

  const getLocation = () => {
    setLocationError(null);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          setLocationError(error.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationError("Geolocation not supported");
    }
  };

  useEffect(() => {
    startCamera();
    getLocation();
    fetchHistory();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        const photoData = canvasRef.current.toDataURL('image/jpeg', 0.7);
        setPhoto(photoData);
      }
    }
  };

  const retakePhoto = () => {
    setPhoto(null);
    startCamera();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photo || !location || !selectedEmp) {
      alert("Mohon lengkapi foto, lokasi, dan data diri.");
      return;
    }

    setIsSubmitting(true);
    const empName = EMPLOYEES.find(e => e.id === selectedEmp)?.name || '';

    const payload = {
      id: selectedEmp,
      name: empName,
      shift,
      status,
      latitude: location.lat,
      longitude: location.lng,
      photoBase64: photo,
      notes
    };

    if (!GAS_URL) {
      setTimeout(() => {
        alert("Data berhasil disimpan! (Mode Simulasi - VITE_GAS_URL belum diatur)");
        setIsSubmitting(false);
        setPhoto(null);
        startCamera();
        setNotes('');
      }, 1500);
      return;
    }

    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        }
      });
      
      const result = await response.json();
      if (result.success) {
        alert("Absensi berhasil dicatat!");
        setPhoto(null);
        startCamera();
        setNotes('');
        
        // Beri jeda sedikit agar Google Sheets selesai menyimpan data sebelum kita fetch ulang
        setTimeout(() => {
          fetchHistory();
        }, 1500);
      } else {
        alert("Gagal: " + result.error);
      }
      
    } catch (error) {
      console.error("Fetch error:", error);
      alert("Terjadi kesalahan jaringan. Pastikan Web App di-deploy dengan akses 'Anyone'.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-cyan-50 font-sans selection:bg-cyan-500/30">
      {/* Header */}
      <header className="p-4 border-b border-cyan-500/20 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-wider text-center uppercase">
          Nexus Attendance
        </h1>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-6 pb-24">
        {/* Camera Section */}
        <section className="space-y-2">
          <div className="flex items-center justify-between text-cyan-400">
            <h2 className="text-sm font-semibold uppercase tracking-widest flex items-center gap-2">
              <Camera size={16} /> Visual Scan
            </h2>
            {photo && (
              <button type="button" onClick={retakePhoto} className="text-xs text-cyan-500 hover:text-cyan-300 flex items-center gap-1">
                <RefreshCw size={12} /> Retake
              </button>
            )}
          </div>
          
          <div className="relative rounded-xl overflow-hidden border-2 border-cyan-500/30 bg-slate-900 aspect-[3/4] shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/80 backdrop-blur-sm">
                <AlertTriangle size={48} className="text-red-500 mb-4" />
                <p className="text-sm text-red-400 mb-4">{cameraError}</p>
                <button 
                  type="button" 
                  onClick={startCamera}
                  className="px-4 py-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 rounded-lg hover:bg-cyan-500/30 transition-colors flex items-center gap-2 text-sm uppercase tracking-wider"
                >
                  <RefreshCw size={14} /> Coba Lagi
                </button>
              </div>
            ) : !photo ? (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute inset-0 border-2 border-cyan-400/50 m-4 rounded-lg pointer-events-none">
                   {/* HUD elements */}
                   <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400"></div>
                   <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400"></div>
                   <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400"></div>
                   <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400"></div>
                </div>
                <button 
                  type="button"
                  onClick={capturePhoto}
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full border-4 border-cyan-400 bg-cyan-500/20 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
                >
                  <div className="w-12 h-12 rounded-full bg-cyan-400/50"></div>
                </button>
              </>
            ) : (
              <img src={photo} alt="Captured" className="w-full h-full object-cover" />
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </section>

        {/* Location Section */}
        <section className="bg-slate-900/50 border border-cyan-500/20 rounded-xl p-4 shadow-[0_0_10px_rgba(6,182,212,0.05)]">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${location ? 'bg-cyan-500/20 text-cyan-400' : 'bg-red-500/20 text-red-400'}`}>
              <MapPin size={20} />
            </div>
            <div className="flex-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">GPS Coordinates</h3>
              {location ? (
                <div className="font-mono text-sm text-cyan-300">
                  {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </div>
              ) : locationError ? (
                <div className="text-xs text-red-400">{locationError}</div>
              ) : (
                <div className="text-xs text-slate-500 animate-pulse">Acquiring signal...</div>
              )}
            </div>
            {!location && (
              <button type="button" onClick={getLocation} className="text-cyan-500 p-2">
                <RefreshCw size={16} />
              </button>
            )}
          </div>
        </section>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-cyan-500 flex items-center gap-2">
              <User size={14} /> Identity
            </label>
            <select 
              value={selectedEmp}
              onChange={(e) => setSelectedEmp(e.target.value)}
              required
              className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg p-3 text-cyan-50 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 appearance-none"
            >
              <option value="" disabled>Select Employee...</option>
              {EMPLOYEES.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.id} - {emp.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-cyan-500 flex items-center gap-2">
                <Clock size={14} /> Shift
              </label>
              <select 
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg p-3 text-cyan-50 focus:outline-none focus:border-cyan-400 appearance-none"
              >
                <option value="pagi">Pagi</option>
                <option value="sore">Sore</option>
                <option value="malam">Malam</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-cyan-500 flex items-center gap-2">
                <CheckCircle2 size={14} /> Status
              </label>
              <select 
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg p-3 text-cyan-50 focus:outline-none focus:border-cyan-400 appearance-none"
              >
                <option value="HADIR">HADIR</option>
                <option value="TERLAMBAT">TERLAMBAT</option>
                <option value="IZIN">IZIN</option>
                <option value="SAKIT">SAKIT</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-cyan-500 flex items-center gap-2">
              <AlertTriangle size={14} /> Notes
            </label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              className="w-full bg-slate-900 border border-cyan-500/30 rounded-lg p-3 text-cyan-50 focus:outline-none focus:border-cyan-400 resize-none"
            />
          </div>

          <button 
            type="submit"
            disabled={isSubmitting || !photo || !location || !selectedEmp}
            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold uppercase tracking-widest py-4 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:shadow-none transition-all flex items-center justify-center gap-2 mt-6"
          >
            {isSubmitting ? (
              <RefreshCw className="animate-spin" size={20} />
            ) : (
              <>
                <Send size={20} /> Transmit Data
              </>
            )}
          </button>
        </form>

        {/* History Section */}
        <section className="mt-10 space-y-4">
          <div className="flex items-center justify-between text-cyan-400 border-b border-cyan-500/20 pb-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest flex items-center gap-2">
              <History size={16} /> Riwayat Absensi
            </h2>
            <button type="button" onClick={fetchHistory} className="text-cyan-500 hover:text-cyan-300 p-1">
              <RefreshCw size={14} className={isLoadingHistory ? "animate-spin" : ""} />
            </button>
          </div>
          
          <div className="space-y-3">
            {isLoadingHistory && history.length === 0 ? (
              <div className="text-center text-xs text-cyan-500/50 py-8 animate-pulse">Memuat riwayat data...</div>
            ) : history.length > 0 ? (
              history.map((record, idx) => (
                <div key={idx} className="bg-slate-900/50 border border-cyan-500/20 rounded-xl p-3 flex items-center gap-3 shadow-[0_0_10px_rgba(6,182,212,0.05)]">
                  {record.photo ? (
                    <img src={record.photo} alt="foto" className="w-12 h-12 rounded-lg object-cover border border-cyan-500/30" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700">
                      <User size={20} className="text-slate-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-cyan-50 truncate">{record.name}</h4>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                      <span>{record.timestamp ? new Date(record.timestamp).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : '-'}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                      <span className="uppercase">{record.shift}</span>
                    </div>
                  </div>
                  <div className={`text-xs font-bold px-2 py-1 rounded-md uppercase ${
                    record.status === 'HADIR' ? 'bg-emerald-500/20 text-emerald-400' :
                    record.status === 'TERLAMBAT' ? 'bg-orange-500/20 text-orange-400' :
                    record.status === 'SAKIT' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>
                    {record.status}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-xs text-slate-500 py-8 bg-slate-900/30 rounded-xl border border-dashed border-slate-700">
                Belum ada data absensi.
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}

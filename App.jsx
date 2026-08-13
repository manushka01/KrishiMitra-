// PASTE THIS ENTIRE FILE AS App.jsx
// Real-time weather added via OpenWeatherMap API
import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";

import { useState, useEffect, useRef } from "react";

// Alert popup animation style inject
const alertStyle = document.createElement('style');
alertStyle.textContent = `
  @keyframes slideDown {
    from { transform: translateY(-100%); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  .animate-bounce-in { animation: slideDown 0.4s ease-out; }
`;
document.head.appendChild(alertStyle);

// ── WEATHER CONFIG ───────────────────────────────────────────────────────────
// OpenWeatherMap free key — works out of the box
const WEATHER_API_KEY = "1db1eda37d53e9472097aa1fe4b343a4";
// ─────────────────────────────────────────────────────────────────────────────

const CROPS = ["गेहूं (Wheat)","धान (Rice)","सोयाबीन (Soybean)","मक्का (Maize)","कपास (Cotton)","गन्ना (Sugarcane)","टमाटर (Tomato)","प्याज (Onion)"];
const CROP_PROFIT_DATA = {
  "गेहूं (Wheat)":     {cost:18000,revenue:32000,yield:"40 q/ha",season:"रबी",   risk:"कम"},
  "धान (Rice)":        {cost:22000,revenue:38000,yield:"50 q/ha",season:"खरीफ", risk:"मध्यम"},
  "सोयाबीन (Soybean)":{cost:14000,revenue:28000,yield:"25 q/ha",season:"खरीफ", risk:"कम"},
  "मक्का (Maize)":    {cost:16000,revenue:30000,yield:"60 q/ha",season:"खरीफ", risk:"कम"},
  "कपास (Cotton)":    {cost:28000,revenue:55000,yield:"20 q/ha",season:"खरीफ", risk:"उच्च"},
  "गन्ना (Sugarcane)":{cost:35000,revenue:70000,yield:"800 q/ha",season:"वर्षभर",risk:"मध्यम"},
  "टमाटर (Tomato)":   {cost:45000,revenue:90000,yield:"300 q/ha",season:"रबी",  risk:"उच्च"},
  "प्याज (Onion)":    {cost:30000,revenue:60000,yield:"200 q/ha",season:"रबी",  risk:"उच्च"},
};
const DISEASE_MOCK = [
  {name:"पर्ण कुंचन (Leaf Curl)",confidence:87,severity:"मध्यम",treatment:"नीम तेल स्प्रे करें, 3 दिन में दोहराएं",color:"#f59e0b"},
  {name:"भूरा धब्बा (Brown Spot)",confidence:72,severity:"हल्का",treatment:"मैन्कोज़ेब 2g/L पानी में मिलाकर छिड़काव करें",color:"#10b981"},
];
const CHAT_SUGGESTIONS = [
  "मेरी फसल में कीट लग रहे हैं?","इस हफ्ते बारिश होगी?",
  "गेहूं की सबसे अच्छी किस्म?","खाद कब और कितनी डालें?","फसल बीमा कैसे लें?",
];

// Hindi condition map
function conditionHindi(d){
  const m={"clear sky":"साफ आसमान","few clouds":"थोड़े बादल","scattered clouds":"बिखरे बादल","broken clouds":"टूटे बादल","overcast clouds":"घने बादल","light rain":"हल्की बारिश","moderate rain":"मध्यम बारिश","heavy intensity rain":"भारी बारिश","thunderstorm":"गरज-चमक","snow":"बर्फबारी","mist":"धुंध","haze":"धुंध","fog":"कोहरा"};
  return m[d?.toLowerCase()]||d||"आंशिक बादल";
}
function wIcon(id){
  if(!id)return"⛅";
  if(id>=200&&id<300)return"⛈️";
  if(id>=300&&id<400)return"🌦️";
  if(id>=500&&id<600)return"🌧️";
  if(id>=600&&id<700)return"❄️";
  if(id>=700&&id<800)return"🌫️";
  if(id===800)return"☀️";
  if(id>800)return"⛅";
  return"🌤️";
}
function getRisk(h,t){
  if(h>80&&t>25)return{level:"उच्च",color:"#ef4444",icon:"🔴"};
  if(h>65&&t>22)return{level:"मध्यम",color:"#f59e0b",icon:"🟡"};
  return{level:"कम",color:"#10b981",icon:"🟢"};
}

// ── SMART WEATHER ALERT SYSTEM ────────────────────────────────────────────────
// Conditions check karke alerts generate karta hai
function generateWeatherAlerts(weather) {
  if (!weather) return [];
  const alerts = [];
  const { temp, humidity, wind, rainChance } = weather;

  // 🌧️ Baarish alert
  if (rainChance >= 80) {
    alerts.push({
      id: "rain_heavy",
      icon: "🌧️",
      title: "भारी बारिश की चेतावनी!",
      desc: `${rainChance}% वर्षा संभावना – फसल काटना तुरंत बंद करें, जल निकासी बनाएं`,
      color: "#1d4ed8",
      bg: "#dbeafe",
      sound: true,
      severity: "high",
    });
  } else if (rainChance >= 50) {
    alerts.push({
      id: "rain_moderate",
      icon: "🌦️",
      title: "बारिश की संभावना",
      desc: `${rainChance}% वर्षा – सिंचाई बंद रखें, फसल की सुरक्षा करें`,
      color: "#2563eb",
      bg: "#eff6ff",
      sound: false,
      severity: "medium",
    });
  }

  // 🌡️ Temperature alert
  if (temp >= 42) {
    alerts.push({
      id: "temp_extreme",
      icon: "🔥",
      title: "अत्यधिक गर्मी – खतरा!",
      desc: `तापमान ${temp}°C – फसल झुलस सकती है, तुरंत सिंचाई करें`,
      color: "#dc2626",
      bg: "#fee2e2",
      sound: true,
      severity: "high",
    });
  } else if (temp >= 35) {
    alerts.push({
      id: "temp_high",
      icon: "🌡️",
      title: `तापमान अधिक: ${temp}°C`,
      desc: "सुबह 7 बजे से पहले या शाम 6 बजे बाद सिंचाई करें",
      color: "#ea580c",
      bg: "#fff7ed",
      sound: false,
      severity: "medium",
    });
  } else if (temp <= 5) {
    alerts.push({
      id: "frost",
      icon: "❄️",
      title: "पाला पड़ने का खतरा!",
      desc: `तापमान ${temp}°C – फसल को तुरंत ढकें, रात को हल्की सिंचाई करें`,
      color: "#7c3aed",
      bg: "#f5f3ff",
      sound: true,
      severity: "high",
    });
  }

  // 🍄 Fungal risk alert
  if (humidity >= 85 && temp >= 25) {
    alerts.push({
      id: "fungal_high",
      icon: "🍄",
      title: "फफूंद रोग – तत्काल कार्रवाई!",
      desc: `नमी ${humidity}% + तापमान ${temp}°C – नीम तेल 5ml/L तुरंत छिड़काव करें`,
      color: "#b45309",
      bg: "#fef3c7",
      sound: true,
      severity: "high",
    });
  } else if (humidity >= 70 && temp >= 22) {
    alerts.push({
      id: "fungal_medium",
      icon: "🍄",
      title: `फफूंद जोखिम: मध्यम (नमी ${humidity}%)`,
      desc: "मैन्कोज़ेब 2g/L का छिड़काव करें और खेत में जल निकासी रखें",
      color: "#d97706",
      bg: "#fffbeb",
      sound: false,
      severity: "medium",
    });
  }

  // 💨 Wind alert
  if (wind >= 50) {
    alerts.push({
      id: "wind_storm",
      icon: "🌪️",
      title: "तूफानी हवा – खतरा!",
      desc: `हवा ${wind} km/h – छिड़काव बिल्कुल न करें, फसल को सहारा दें`,
      color: "#6d28d9",
      bg: "#ede9fe",
      sound: true,
      severity: "high",
    });
  } else if (wind >= 30) {
    alerts.push({
      id: "wind_high",
      icon: "💨",
      title: `तेज हवा: ${wind} km/h`,
      desc: "कीटनाशक या खाद का छिड़काव न करें – हवा कम होने का इंतजार करें",
      color: "#7c3aed",
      bg: "#f5f3ff",
      sound: false,
      severity: "medium",
    });
  }

  return alerts;
}

// Browser Notification permission maango
async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const perm = await Notification.requestPermission();
  return perm === "granted";
}

// Browser notification bhejo
function sendBrowserNotification(alert) {
  if (Notification.permission !== "granted") return;
  const notif = new Notification("🌾 KrishiMitra Alert – " + alert.title, {
    body: alert.desc,
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: alert.id, // same id = duplicate nahi aayega
    requireInteraction: alert.severity === "high",
  });
  notif.onclick = () => { window.focus(); notif.close(); };
}

// Alert sound bajao (Web Audio API)
function playAlertSound(severity) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const count = severity === "high" ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = severity === "high" ? 880 : 660;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.4 + 0.3);
      osc.start(ctx.currentTime + i * 0.4);
      osc.stop(ctx.currentTime + i * 0.4 + 0.3);
    }
  } catch(e) { /* audio not supported */ }
}

// ── ALERT POPUP COMPONENT ─────────────────────────────────────────────────────
function AlertPopup({ alerts, onDismiss }) {
  const [visible, setVisible] = useState(true);
  const highAlerts = alerts.filter(a => a.severity === "high");
  if (!visible || highAlerts.length === 0) return null;
  const top = highAlerts[0];

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center px-3 pt-3 animate-bounce-in">
      <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: top.bg, border: `2px solid ${top.color}` }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3"
          style={{ background: top.color }}>
          <span className="text-2xl">{top.icon}</span>
          <div className="flex-1">
            <p className="font-bold text-white text-sm">{top.title}</p>
            <p className="text-white/80 text-xs">KrishiMitra स्मार्ट अलर्ट</p>
          </div>
          <button onClick={() => { setVisible(false); onDismiss(); }}
            className="text-white/80 hover:text-white text-xl font-bold w-7 h-7 flex items-center justify-center">
            ✕
          </button>
        </div>
        {/* Body */}
        <div className="px-4 py-3">
          <p className="text-sm font-semibold mb-2" style={{ color: top.color }}>{top.desc}</p>
          {highAlerts.length > 1 && (
            <p className="text-xs text-gray-500">+{highAlerts.length - 1} और अलर्ट नीचे देखें</p>
          )}
          <button onClick={() => { setVisible(false); onDismiss(); }}
            className="mt-2 w-full py-2 rounded-xl text-white text-xs font-bold"
            style={{ background: top.color }}>
            समझ गया – बंद करें
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ALERTS PANEL (dashboard mein full list) ────────────────────────────────────
function SmartAlertsPanel({ alerts, weather }) {
  if (!weather) return null;
  return (
    <div className="rounded-2xl p-4 shadow bg-white">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">🔔</span>
        <h3 className="font-bold text-gray-800">स्मार्ट मौसम अलर्ट</h3>
        <span className="ml-auto text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-semibold">Live</span>
      </div>
      {alerts.length === 0 ? (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border-l-4 border-green-400">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-sm text-green-700">सब कुछ ठीक है!</p>
            <p className="text-xs text-gray-500">कोई मौसम खतरा नहीं – खेती जारी रखें</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl border-l-4"
              style={{ borderColor: a.color, background: a.bg }}>
              <span className="text-xl mt-0.5">{a.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm" style={{ color: a.color }}>{a.title}</p>
                  {a.severity === "high" && (
                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">⚠️ तत्काल</span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-0.5">{a.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ── GROQ API (Free AI) ───────────────────────────────────────────────────────
const GROQ_API_KEY = "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";
const GROQ_MODEL   = "llama3-70b-8192"; // best free model

async function callClaude(messages, system) {
  try {
    // Vite proxy ke through call — CORS issue nahi hoga
    const res = await fetch("/api/groq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 800,
        temperature: 0.7,
        messages: [
          { role: "system", content: system },
          ...messages,
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Groq error:", err);
      return "माफ करें, AI सेवा उपलब्ध नहीं है। थोड़ी देर बाद पुनः प्रयास करें।";
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "माफ करें, उत्तर नहीं मिला।";

  } catch (err) {
    console.error("Network error:", err);
    return "नेटवर्क समस्या है। इंटरनेट कनेक्शन जांचें और पुनः प्रयास करें।";
  }
}

// ── WEATHER FETCH by city name ────────────────────────────────────────────────
async function fetchWeatherByCity(city) {
  const r = await fetch(
    `/api/weather/weather?q=${encodeURIComponent(city)}&appid=${WEATHER_API_KEY}&units=metric`
  );
  if (!r.ok) throw new Error("शहर नहीं मिला – सही नाम लिखें");
  const d = await r.json();
  const fr = await fetch(
    `/api/weather/forecast?q=${encodeURIComponent(city)}&appid=${WEATHER_API_KEY}&units=metric&cnt=5`
  );
  const fd = await fr.json();
  const days = ["आज","कल","परसों","4 दिन","5 दिन"];
  return {
    city: d.name + ", " + d.sys.country,
    temp: Math.round(d.main.temp),
    feelsLike: Math.round(d.main.feels_like),
    humidity: d.main.humidity,
    wind: Math.round(d.wind.speed * 3.6),
    condition: conditionHindi(d.weather?.[0]?.description),
    icon: wIcon(d.weather?.[0]?.id),
    rainChance: Math.round(((fd.list?.[0]?.pop) || 0) * 100),
    forecast: (fd.list || []).slice(0,5).map((f,i) => ({
      day: days[i], icon: wIcon(f.weather?.[0]?.id),
      high: Math.round(f.main.temp_max), low: Math.round(f.main.temp_min),
      rain: Math.round((f.pop || 0) * 100),
    })),
    lastUpdated: new Date().toLocaleTimeString("hi-IN"),
  };
}

// ── CITY SEARCH MODAL ─────────────────────────────────────────────────────────
function CitySearchModal({ onSelect, onClose }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const POPULAR = [
    "Mumbai","Delhi","Pune","Nagpur","Nashik","Lucknow","Patna",
    "Jaipur","Indore","Bhopal","Hyderabad","Bangalore","Chennai",
    "Kolkata","Ahmedabad","Ludhiana","Varanasi","Agra","Surat","Kanpur",
  ];

  const doSearch = async (city) => {
    const c = city || query.trim();
    if (!c) return;
    setSearching(true); setErr("");
    try {
      const w = await fetchWeatherByCity(c);
      onSelect(w);
    } catch(e) {
      setErr(e.message);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-3xl w-full max-w-lg p-5 pb-8 max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4"/>
        <h3 className="font-bold text-gray-800 text-lg mb-4">📍 अपना शहर चुनें</h3>
        <div className="flex gap-2 mb-3">
          <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&doSearch()}
            placeholder="शहर का नाम लिखें... (e.g. Delhi, Pune)"
            className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"/>
          <button onClick={()=>doSearch()} disabled={searching}
            className="px-5 py-3 rounded-xl text-white font-bold text-sm"
            style={{background: searching?"#86efac":"#16a34a"}}>
            {searching?"⏳":"खोजें"}
          </button>
        </div>
        {err && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 text-sm text-red-600">❌ {err}</div>}
        <p className="text-xs text-gray-500 font-semibold mb-3 uppercase tracking-wider">लोकप्रिय शहर</p>
        <div className="flex flex-wrap gap-2">
          {POPULAR.map(city => (
            <button key={city} onClick={() => doSearch(city)}
              className="px-3 py-2 rounded-xl text-sm font-semibold border-2 border-green-100 text-green-700 bg-green-50 hover:bg-green-100">
              {city}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── WEATHER CARD ──────────────────────────────────────────────────────────────
function WeatherCard({ w, loading, onChangeCity }) {
  if (loading) return (
    <div className="rounded-2xl p-5 shadow-lg flex flex-col items-center justify-center h-44"
      style={{background:"linear-gradient(135deg,#1a472a,#2d6a4f)"}}>
      <p className="text-4xl animate-pulse">🌤️</p>
      <p className="text-green-200 text-sm mt-2">मौसम लोड हो रहा है...</p>
    </div>
  );
  if (!w) return (
    <div className="rounded-2xl p-5 shadow-lg flex flex-col items-center justify-center h-32"
      style={{background:"linear-gradient(135deg,#1a472a,#2d6a4f)"}}>
      <button onClick={onChangeCity} className="bg-white/20 text-white px-4 py-2 rounded-xl font-semibold text-sm">
        📍 शहर चुनें → Live Weather देखें
      </button>
    </div>
  );
  const risk = getRisk(w.humidity, w.temp);
  return (
    <div className="rounded-2xl p-5 shadow-lg" style={{background:"linear-gradient(135deg,#1a472a,#2d6a4f)"}}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-green-200 text-xs font-semibold uppercase tracking-widest">📍 {w.city}</p>
        <button onClick={onChangeCity}
          className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-full font-semibold">
          🔄 बदलें
        </button>
      </div>
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-end gap-2">
            <p className="text-white text-5xl font-bold">{w.temp}°C</p>
            <p className="text-3xl mb-1">{w.icon}</p>
          </div>
          <p className="text-green-200 mt-1">{w.condition}</p>
          <p className="text-green-300 text-xs mt-0.5">feels like {w.feelsLike}°C</p>
        </div>
        <div className="bg-white/10 rounded-xl p-3 text-right">
          <p className="text-white/70 text-xs">आर्द्रता</p><p className="text-white font-bold text-lg">{w.humidity}%</p>
          <p className="text-white/70 text-xs mt-1">हवा</p><p className="text-white font-bold">{w.wind} km/h</p>
          <p className="text-white/70 text-xs mt-1">बारिश</p><p className="text-blue-300 font-bold">{w.rainChance}%</p>
        </div>
      </div>
      <div className="bg-white/10 rounded-xl p-3 mb-3">
        <p className="text-green-200 text-xs mb-1">🍄 फफूंद जोखिम</p>
        <div className="flex items-center gap-2">
          <span>{risk.icon}</span>
          <span className="font-bold text-white">{risk.level}</span>
          <span className="text-white/50 text-xs ml-auto">अपडेट: {w.lastUpdated}</span>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {w.forecast.map((f,i) => (
          <div key={i} className="bg-white/10 rounded-lg p-2 text-center">
            <p className="text-green-200 text-xs">{f.day}</p>
            <p className="text-lg">{f.icon}</p>
            <p className="text-white text-xs font-bold">{f.high}°</p>
            <p className="text-blue-300 text-xs">{f.rain}%🌧</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ALERT BANNER ──────────────────────────────────────────────────────────────
function AlertBanner({alerts}){
  const [idx,setIdx]=useState(0);
  useEffect(()=>{const t=setInterval(()=>setIdx(i=>(i+1)%alerts.length),4000);return()=>clearInterval(t);},[alerts.length]);
  if(!alerts.length)return null;
  const a=alerts[idx];
  return(
    <div style={{background:a.bg,color:a.color}} className="flex items-center gap-3 px-4 py-2 text-sm font-semibold rounded-xl mb-4 shadow">
      <span>{a.icon}</span><span>{a.text}</span><span className="ml-auto text-xs opacity-70">{idx+1}/{alerts.length}</span>
    </div>
  );
}

// ── WEATHER CARD (real-time) ───────────────────────────────────────────────────
function WeatherCard({w,loading,error}){
  if(loading)return(
    <div className="rounded-2xl p-5 shadow-lg flex items-center justify-center h-40" style={{background:"linear-gradient(135deg,#1a472a,#2d6a4f)"}}>
      <div className="text-center"><p className="text-3xl animate-pulse">🌤️</p><p className="text-green-200 text-sm mt-2">मौसम लोड हो रहा है...</p></div>
    </div>
  );
  const risk=getRisk(w.humidity,w.temp);
  return(
    <div className="rounded-2xl p-5 shadow-lg" style={{background:"linear-gradient(135deg,#1a472a,#2d6a4f)"}}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-green-200 text-xs font-semibold uppercase tracking-widest">📍 {w.city}</p>
          <div className="flex items-end gap-2 mt-1">
            <p className="text-white text-5xl font-bold">{w.temp}°C</p>
            <p className="text-3xl mb-1">{w.icon}</p>
          </div>
          <p className="text-green-200">{w.condition}</p>
          <p className="text-green-300 text-xs mt-0.5">feels like {w.feelsLike}°C</p>
        </div>
        <div className="bg-white/10 rounded-xl p-3 text-right">
          <p className="text-white/70 text-xs">आर्द्रता</p><p className="text-white font-bold text-lg">{w.humidity}%</p>
          <p className="text-white/70 text-xs mt-1">हवा</p><p className="text-white font-bold">{w.wind} km/h</p>
          <p className="text-white/70 text-xs mt-1">बारिश</p><p className="text-blue-300 font-bold">{w.rainChance}%</p>
        </div>
      </div>
      {error&&<div className="bg-yellow-500/20 rounded-xl p-2 mb-3 text-xs text-yellow-200">⚠️ API key डालें – अभी mock data है। WEATHER_API_KEY बदलें।</div>}
      <div className="bg-white/10 rounded-xl p-3 mb-3">
        <p className="text-green-200 text-xs mb-1">🍄 फफूंद जोखिम (AI)</p>
        <div className="flex items-center gap-2">
          <span>{risk.icon}</span><span className="font-bold text-white">{risk.level}</span>
          <span className="text-white/60 text-xs ml-auto">अपडेट: {w.lastUpdated}</span>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {w.forecast.map((f,i)=>(
          <div key={i} className="bg-white/10 rounded-lg p-2 text-center">
            <p className="text-green-200 text-xs">{f.day}</p><p className="text-lg">{f.icon}</p>
            <p className="text-white text-xs font-bold">{f.high}°</p><p className="text-blue-300 text-xs">{f.rain}%🌧</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function DashboardPage({farmer, setFarmer, weather, weatherLoading, onChangeCity}){
  const [showEdit,setShowEdit]=useState(false);
  const [editForm,setEditForm]=useState({...farmer});
  const loading = weatherLoading;
  const [showPopup, setShowPopup] = useState(false);
  const [notifAsked, setNotifAsked] = useState(false);
  const smartAlerts = generateWeatherAlerts(weather);

  // Jab weather aaye → check alerts → sound + browser notif
  useEffect(() => {
    if (!weather || smartAlerts.length === 0) return;

    // Popup dikhao
    setShowPopup(true);

    // Sound bajao (sirf high severity pe)
    const highAlerts = smartAlerts.filter(a => a.severity === "high");
    if (highAlerts.length > 0) playAlertSound("high");
    else playAlertSound("medium");

    // Browser notification
    if (!notifAsked) {
      setNotifAsked(true);
      requestNotificationPermission().then(granted => {
        if (granted) {
          smartAlerts.filter(a => a.sound).forEach(a => sendBrowserNotification(a));
        }
      });
    } else if (Notification.permission === "granted") {
      smartAlerts.filter(a => a.sound).forEach(a => sendBrowserNotification(a));
    }
  }, [weather?.temp, weather?.humidity, weather?.wind, weather?.rainChance]);

  const alerts=weather?[
    weather.rainChance>50
      ?{icon:"🌧️",title:`${weather.rainChance}% बारिश की संभावना`,desc:"कटाई टालें, नाली बनाएं",color:"#3b82f6",bg:"#eff6ff"}
      :{icon:"☀️",title:"मौसम साफ है",desc:"सिंचाई के लिए उचित समय",color:"#10b981",bg:"#f0fdf4"},
    weather.humidity>75
      ?{icon:"🍄",title:`फफूंद जोखिम: उच्च (${weather.humidity}%)`,desc:"नीम तेल छिड़काव करें",color:"#ef4444",bg:"#fef2f2"}
      :{icon:"🍄",title:`फफूंद जोखिम: कम (${weather.humidity}%)`,desc:"स्थिति सामान्य",color:"#10b981",bg:"#f0fdf4"},
    weather.temp>35
      ?{icon:"🌡️",title:`तापमान अधिक: ${weather.temp}°C`,desc:"सुबह या शाम सिंचाई करें",color:"#f59e0b",bg:"#fffbeb"}
      :{icon:"🌡️",title:`तापमान: ${weather.temp}°C`,desc:`feels like ${weather.feelsLike}°C`,color:"#6b7280",bg:"#f9fafb"},
    {icon:"💨",title:`हवा: ${weather.wind} km/h`,desc:weather.wind>30?"तेज हवा – छिड़काव न करें":"छिड़काव के लिए उचित मौसम",color:"#8b5cf6",bg:"#f5f3ff"},
  ]:[];

  const marquee=[
    {icon:"⚠️",text:"कल भारी वर्षा – फसल की सुरक्षा करें",bg:"#fef3c7",color:"#92400e"},
    {icon:"🌡️",text:"तापमान 30°C से ऊपर – अधिक सिंचाई करें",bg:"#fee2e2",color:"#991b1b"},
    {icon:"✅",text:"गेहूं की MSP ₹2,275/क्विंटल घोषित",bg:"#d1fae5",color:"#065f46"},
  ];

  return(
    <div className="space-y-4 pb-20">
      <AlertBanner alerts={marquee}/>

      {/* Profile */}
      <div className="rounded-2xl p-4 shadow bg-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl" style={{background:"#d1fae5"}}>👨‍🌾</div>
          <div><p className="font-bold text-gray-800">{farmer.name}</p><p className="text-sm text-gray-500">📍 {farmer.location}</p></div>
          <button onClick={()=>setShowEdit(true)} className="ml-auto text-xs text-green-600 font-semibold border border-green-200 px-3 py-1 rounded-lg">संपादित करें</button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[["🌾","फसल",farmer.crop.split("(")[0],"#f0fdf4"],["📐","क्षेत्र",farmer.area+" एकड़","#eff6ff"],["📅","अनुभव",farmer.experience+" वर्ष","#fefce8"]].map(([e,l,v,c],i)=>(
            <div key={i} className="rounded-xl p-2 text-center" style={{background:c}}>
              <p className="text-lg">{e}</p><p className="text-xs text-gray-500">{l}</p><p className="text-xs font-bold text-gray-700">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* LIVE WEATHER */}
      <WeatherCard w={weather} loading={loading} onChangeCity={onChangeCity}/>

      {/* Smart Alerts Popup */}
      {showPopup && <AlertPopup alerts={smartAlerts} onDismiss={() => setShowPopup(false)} />}

      {/* Smart Alerts Panel */}
      <SmartAlertsPanel alerts={smartAlerts} weather={weather} />

      {/* Crop status */}
      <div className="bg-white rounded-2xl p-4 shadow">
        <h3 className="font-bold text-gray-800 mb-3">🌱 फसल स्थिति – {farmer.crop.split("(")[0]}</h3>
        {[
          {label:"विकास चरण",value:"फूल आना",percent:65,color:"#10b981"},
          {label:"मिट्टी नमी",value:weather?`${weather.humidity}%`:"72%",percent:weather?.humidity||72,color:"#3b82f6"},
          {label:"पोषण स्तर",value:"अच्छा",percent:80,color:"#8b5cf6"},
        ].map((item,i)=>(
          <div key={i} className="mb-3">
            <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">{item.label}</span><span className="font-semibold text-gray-800">{item.value}</span></div>
            <div className="w-full bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full" style={{width:`${item.percent}%`,background:item.color}}/></div>
          </div>
        ))}
      </div>

      {/* AI tip based on live weather */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-500 rounded-2xl p-4 text-white">
        <h3 className="font-bold mb-2 flex items-center gap-2">💡 AI सुझाव (Live मौसम पर)</h3>
        <p className="text-green-100 text-sm leading-relaxed">
          {!weather?"मौसम डेटा लोड हो रहा है...":
           weather.rainChance>50?`🌧️ आज ${weather.rainChance}% बारिश – सिंचाई बंद रखें और जल निकासी सुनिश्चित करें।`:
           weather.humidity>75?`🍄 नमी ${weather.humidity}% – फफूंद जोखिम उच्च है। नीम तेल (5ml/L) तुरंत छिड़काव करें।`:
           weather.temp>35?`🌡️ तापमान ${weather.temp}°C – सुबह 7 बजे से पहले सिंचाई करें। दोपहर में खेत में न जाएं।`:
           `✅ मौसम अनुकूल है (${weather.temp}°C, ${weather.humidity}% नमी)। ${farmer.crop.split("(")[0]} की नियमित देखभाल जारी रखें।`}
        </p>
      </div>

      {/* Edit Modal */}
      {showEdit&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-800 text-lg mb-4">प्रोफ़ाइल संपादित करें</h3>
            {[{label:"नाम",key:"name",type:"text"},{label:"स्थान",key:"location",type:"text"},{label:"क्षेत्र (एकड़)",key:"area",type:"number"},{label:"अनुभव (वर्ष)",key:"experience",type:"number"}].map(f=>(
              <div key={f.key} className="mb-3">
                <label className="text-sm text-gray-600 mb-1 block">{f.label}</label>
                <input type={f.type} value={editForm[f.key]} onChange={e=>setEditForm({...editForm,[f.key]:e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400"/>
              </div>
            ))}
            <div className="mb-4">
              <label className="text-sm text-gray-600 mb-1 block">फसल</label>
              <select value={editForm.crop} onChange={e=>setEditForm({...editForm,crop:e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400">
                {CROPS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setShowEdit(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm">रद्द</button>
              <button onClick={()=>{setFarmer(editForm);setShowEdit(false);}} className="flex-1 py-2 rounded-xl text-white text-sm font-semibold" style={{background:"#16a34a"}}>सहेजें</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CHAT PAGE ─────────────────────────────────────────────────────────────────
function ChatPage({farmer, weather}){
  const [messages,setMessages]=useState([{role:"assistant",text:`नमस्ते ${farmer.name} जी! 🙏 मैं KrishiMitra हूं। आपकी ${farmer.crop.split("(")[0]} फसल के बारे में पूछें।`}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [listening,setListening]=useState(false);
  const bottomRef=useRef(null);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);

  const SYSTEM = [
    `You are KrishiMitra, an expert AI farming assistant for Indian farmers.`,
    `Farmer: Name=${farmer.name}, Location=${farmer.location}, Crop=${farmer.crop}, Area=${farmer.area} acres.`,
    `Live Weather: ${weather?.temp||28}°C, Humidity=${weather?.humidity||74}%, Rain=${weather?.rainChance||20}%.`,
    `RULES: 1) ALWAYS reply in Hindi (Devanagari) 2) Give UNIQUE answer every time 3) Be specific to crop & location 4) Include exact quantities/timings 5) Max 4 sentences 6) End with farming emoji`
  ].join(" ");

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg) return;
    setInput("");
    setLoading(true);

    const newMsg = { role: "user", text: msg };
    const allMsgs = [...messages, newMsg];
    setMessages(allMsgs);

    // Build API messages - skip first greeting message
    const apiMsgs = allMsgs
      .slice(messages[0]?.role === "assistant" ? 1 : 0)
      .map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }));

    const toSend = apiMsgs.length > 0 ? apiMsgs : [{ role: "user", content: msg }];
    const reply = await callClaude(toSend, SYSTEM);
    setMessages(prev => [...prev, { role: "assistant", text: reply }]);
    setLoading(false);
  };

  const startVoice=()=>{
    if(!("webkitSpeechRecognition"in window||"SpeechRecognition"in window)){alert("वॉइस सपोर्ट नहीं");return;}
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    const r=new SR();r.lang="hi-IN";
    r.onstart=()=>setListening(true);r.onend=()=>setListening(false);
    r.onresult=e=>setInput(e.results[0][0].transcript);r.start();
  };

  return(
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {messages.map((m,i)=>(
          <div key={i} className={`flex ${m.role==="user"?"justify-end":"justify-start"}`}>
            {m.role==="assistant"&&<div className="w-8 h-8 rounded-full flex items-center justify-center text-sm mr-2 flex-shrink-0" style={{background:"#d1fae5"}}>🤖</div>}
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${m.role==="user"?"text-white rounded-br-sm":"bg-white text-gray-700 rounded-bl-sm shadow"}`}
              style={m.role==="user"?{background:"#16a34a"}:{}}>{m.text}</div>
          </div>
        ))}
        {loading&&<div className="flex justify-start"><div className="w-8 h-8 rounded-full flex items-center justify-center text-sm mr-2" style={{background:"#d1fae5"}}>🤖</div><div className="bg-white px-4 py-3 rounded-2xl shadow"><div className="flex gap-1">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{background:"#16a34a",animationDelay:`${i*0.15}s`}}/>)}</div></div></div>}
        <div ref={bottomRef}/>
      </div>
      <div className="flex gap-2 overflow-x-auto py-2">
        {CHAT_SUGGESTIONS.map((s,i)=><button key={i} onClick={()=>send(s)} className="flex-shrink-0 text-xs px-3 py-2 rounded-full border text-green-700 border-green-200 bg-green-50 whitespace-nowrap">{s}</button>)}
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={startVoice} className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
          style={{background:listening?"#ef4444":"#f0fdf4",border:`2px solid ${listening?"#ef4444":"#bbf7d0"}`}}>
          {listening?"⏹":"🎤"}
        </button>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="अपना सवाल यहाँ लिखें..."
          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"/>
        <button onClick={()=>send()} className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl" style={{background:"#16a34a"}}>➤</button>
      </div>
    </div>
  );
}

// ── DISEASE PAGE ──────────────────────────────────────────────────────────────
function DiseasePage({farmer}){
  const [image,setImage]=useState(null);
  const [preview,setPreview]=useState(null);
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const fileRef=useRef(null);

  const handleFile=f=>{if(!f)return;setImage(f);setResult(null);const r=new FileReader();r.onloadend=()=>setPreview(r.result);r.readAsDataURL(f);};
  const analyze=async()=>{setLoading(true);await new Promise(r=>setTimeout(r,2000));setResult({diseases:DISEASE_MOCK,overall:"मध्यम जोखिम",suggestion:`${farmer.crop.split("(")[0]} में पर्ण कुंचन रोग – नीम तेल (5ml/L) छिड़काव करें।`,prevention:["संक्रमित पत्तियां तोड़ें","खेत में पानी न भरने दें","स्वस्थ बीज प्रयोग करें"]});setLoading(false);};

  return(
    <div className="space-y-4 pb-20">
      <div className="bg-white rounded-2xl p-4 shadow">
        <h3 className="font-bold text-gray-800 mb-1">📸 फसल रोग पहचान</h3>
        <p className="text-xs text-gray-500 mb-4">पत्ती या तने की फोटो अपलोड करें</p>
        <div onDrop={e=>{e.preventDefault();handleFile(e.dataTransfer.files[0]);}} onDragOver={e=>e.preventDefault()}
          onClick={()=>!preview&&fileRef.current?.click()}
          className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer hover:border-green-400"
          style={{borderColor:preview?"#16a34a":"#d1d5db",background:preview?"#f0fdf4":"#f9fafb"}}>
          {preview?<img src={preview} alt="crop" className="w-full max-h-48 object-contain rounded-xl"/>:<><p className="text-4xl mb-3">📷</p><p className="text-gray-600 font-semibold">फोटो खींचें या चुनें</p><p className="text-gray-400 text-xs mt-1">JPG, PNG – 10MB तक</p></>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e=>handleFile(e.target.files[0])}/>
        {preview&&<div className="flex gap-2 mt-3">
          <button onClick={()=>{setImage(null);setPreview(null);setResult(null);}} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm">हटाएं</button>
          <button onClick={analyze} disabled={loading} className="flex-1 py-3 rounded-xl text-white text-sm font-bold" style={{background:loading?"#86efac":"#16a34a"}}>{loading?"विश्लेषण जारी...":"🔍 जांच करें"}</button>
        </div>}
      </div>
      {result&&<div className="space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4"><p className="font-bold text-amber-800">⚠️ {result.overall}</p><p className="text-sm text-amber-700 mt-1">{result.suggestion}</p></div>
        {result.diseases.map((d,i)=><div key={i} className="bg-white rounded-2xl p-4 shadow">
          <div className="flex justify-between mb-2"><p className="font-bold text-gray-800">{d.name}</p><span className="text-xs px-2 py-1 rounded-full font-bold" style={{background:d.color+"20",color:d.color}}>{d.severity}</span></div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-2"><div className="h-2 rounded-full" style={{width:`${d.confidence}%`,background:d.color}}/></div>
          <div className="bg-green-50 rounded-xl p-3"><p className="text-xs font-semibold text-green-800">💊 उपचार:</p><p className="text-xs text-green-700 mt-1">{d.treatment}</p></div>
        </div>)}
        <div className="bg-white rounded-2xl p-4 shadow"><p className="font-bold text-gray-800 mb-2">🛡️ रोकथाम</p>{result.prevention.map((p,i)=><div key={i} className="flex items-center gap-2 py-1"><span className="text-green-500 font-bold">✓</span><span className="text-sm text-gray-700">{p}</span></div>)}</div>
      </div>}
      {!preview&&<div className="bg-white rounded-2xl p-4 shadow"><p className="font-semibold text-gray-700 mb-3 text-sm">📋 उदाहरण रोग</p><div className="grid grid-cols-2 gap-2">{[["पर्ण कुंचन","🍃","#fef3c7"],["झुलसा रोग","🍂","#fee2e2"],["कीट नुकसान","🐛","#f0fdf4"],["पीला रोग","🌿","#fefce8"]].map(([n,e,c],i)=><div key={i} className="rounded-xl p-4 text-center" style={{background:c}}><p className="text-3xl mb-1">{e}</p><p className="text-xs font-semibold text-gray-700">{n}</p></div>)}</div></div>}
    </div>
  );
}

// ── PROFIT PAGE ───────────────────────────────────────────────────────────────
function ProfitPage({farmer}){
  const [cropA,setCropA]=useState(farmer.crop);
  const [cropB,setCropB]=useState("कपास (Cotton)");
  const [area,setArea]=useState(farmer.area||2);
  const [ai,setAi]=useState("");
  const [busy,setBusy]=useState(false);
  const calc=c=>{const d=CROP_PROFIT_DATA[c];if(!d)return null;return{...d,totalCost:d.cost*area,totalRevenue:d.revenue*area,profit:(d.revenue-d.cost)*area,roi:(((d.revenue-d.cost)/d.cost)*100).toFixed(1)};};
  const a=calc(cropA),b=calc(cropB),fmt=n=>`₹${n?.toLocaleString("en-IN")}`,winner=a&&b?(a.profit>b.profit?cropA:cropB):null;
  const getAI=async()=>{setBusy(true);const r=await callClaude([{role:"user",content:`Farmer ${farmer.location}: ${cropA} profit ₹${a?.profit} vs ${cropB} profit ₹${b?.profit}, ${area} acres. 4-5 sentences Hindi recommendation.`}],"Agricultural expert. Always Hindi.");setAi(r);setBusy(false);};

  return(
    <div className="space-y-4 pb-20">
      <div className="bg-white rounded-2xl p-4 shadow">
        <h3 className="font-bold text-gray-800 mb-4">💰 फसल लाभ तुलनाकर्ता</h3>
        <div className="space-y-3">
          {[{label:"फसल A",val:cropA,set:setCropA},{label:"फसल B",val:cropB,set:setCropB}].map(({label,val,set},i)=>(
            <div key={i}><label className="text-sm text-gray-600 mb-1 block">{label}</label>
              <select value={val} onChange={e=>set(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400">
                {CROPS.map(c=><option key={c}>{c}</option>)}
              </select></div>
          ))}
          <div><label className="text-sm text-gray-600 mb-1 block">क्षेत्र: <strong>{area} एकड़</strong></label>
            <input type="range" min="0.5" max="10" step="0.5" value={area} onChange={e=>setArea(parseFloat(e.target.value))} className="w-full accent-green-600"/></div>
        </div>
      </div>
      {a&&b&&<div className="grid grid-cols-2 gap-3">
        {[{crop:cropA,data:a},{crop:cropB,data:b}].map(({crop,data},i)=>{
          const isW=winner===crop;
          return<div key={i} className="rounded-2xl p-4 shadow relative overflow-hidden" style={{background:isW?"linear-gradient(135deg,#16a34a,#15803d)":"white",border:isW?"none":"2px solid #e5e7eb"}}>
            {isW&&<div className="absolute top-2 right-2 text-xs bg-yellow-400 text-yellow-900 font-bold px-2 py-0.5 rounded-full">🏆 बेहतर</div>}
            <p className="font-bold text-sm mb-3" style={{color:isW?"white":"#1f2937"}}>{crop.split("(")[0]}</p>
            {[["लागत",fmt(data.totalCost)],["आय",fmt(data.totalRevenue)],["लाभ",fmt(data.profit)],["ROI",data.roi+"%"]].map(([l,v],j)=>(
              <div key={j} className="flex justify-between text-xs py-1" style={{borderBottom:`1px solid ${isW?"rgba(255,255,255,0.2)":"#f3f4f6"}`}}>
                <span style={{color:isW?"#bbf7d0":"#6b7280"}}>{l}</span><span className="font-bold" style={{color:isW?"white":"#1f2937"}}>{v}</span>
              </div>
            ))}
          </div>;
        })}
      </div>}
      <div className="bg-white rounded-2xl p-4 shadow">
        <button onClick={getAI} disabled={busy} className="w-full py-3 rounded-xl text-white font-bold text-sm mb-3" style={{background:busy?"#86efac":"#16a34a"}}>
          {busy?"AI विश्लेषण जारी...":"🤖 AI से सुझाव लें"}
        </button>
        {ai&&<div className="bg-green-50 rounded-xl p-3"><p className="text-xs font-bold text-green-800 mb-1">🌾 KrishiMitra सुझाव:</p><p className="text-sm text-green-700 leading-relaxed">{ai}</p></div>}
      </div>
      <div className="bg-white rounded-2xl p-4 shadow">
        <h4 className="font-bold text-gray-800 mb-3">🏛️ सरकारी योजनाएं</h4>
        {[{name:"PM किसान",amount:"₹6,000/वर्ष",status:"उपलब्ध",color:"#10b981"},{name:"फसल बीमा",amount:"प्रीमियम: 2%",status:"पंजीकरण खुला",color:"#3b82f6"},{name:"KCC ऋण",amount:"₹3 लाख तक",status:"ब्याज 4%",color:"#8b5cf6"}].map((s,i)=>(
          <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
            <div><p className="text-sm font-semibold text-gray-800">{s.name}</p><p className="text-xs text-gray-500">{s.amount}</p></div>
            <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{background:s.color+"20",color:s.color}}>{s.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App(){
  const [page,setPage]=useState("dashboard");
  const [farmer,setFarmer]=useState({name:"रामलाल पटेल",location:"पुणे, महाराष्ट्र",crop:"गेहूं (Wheat)",area:3,experience:12,history:[]});
  const [weather,setWeather]=useState(null);
  const [weatherLoading,setWeatherLoading]=useState(true);
  const [showCityModal,setShowCityModal]=useState(false);
  const PAGES=[{id:"dashboard",icon:"🏠",label:"होम"},{id:"chat",icon:"🤖",label:"AI चैट"},{id:"disease",icon:"📸",label:"रोग जांच"},{id:"profit",icon:"💰",label:"लाभ"}];
  const saveWeatherToFirebase = async (weatherData) => {
  try {
    await addDoc(collection(db, "weatherLogs"), {
      ...weatherData,
      createdAt: new Date()
    });
    console.log("✅ Weather saved to Firebase");
  } catch (e) {
    console.log("❌ Firebase error:", e);
  }
};
  // Load Pune weather on start
  useEffect(()=>{
  (async()=>{
    setWeatherLoading(true);
    try{ 
      const w=await fetchWeatherByCity("Pune"); 
      setWeather(w);

      // 🔥 Firebase me save
      saveWeatherToFirebase(w);

    }
    catch(e){ setWeather(null); }
    finally{ setWeatherLoading(false); }
  })();
},[]);

const handleCitySelect=(w)=>{ 
  setWeather(w); 
  setShowCityModal(false);

  // 🔥 Firebase me save
  saveWeatherToFirebase(w);
};
  return(
    <div className="min-h-screen" style={{background:"#f0fdf4",fontFamily:"'Noto Sans Devanagari',sans-serif"}}>
      <header className="sticky top-0 z-40 shadow-sm" style={{background:"linear-gradient(135deg,#14532d,#16a34a)"}}>
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌾</span>
            <div><p className="font-bold text-white text-sm leading-none">KrishiMitra AI</p><p className="text-green-200 text-xs">कृषि बुद्धिमत्ता प्रणाली</p></div>
          </div>
          {/* City button - click karke city badlo */}
          <button onClick={()=>setShowCityModal(true)}
            className="flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded-full px-3 py-1.5 transition-all">
            <span className="text-white text-xs">📍</span>
            <span className="text-white text-xs font-semibold max-w-[90px] truncate">
              {weather ? weather.city.split(",")[0] : "शहर चुनें"}
            </span>
            <span className="text-white/70 text-xs">▼</span>
          </button>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 pt-4">
        {page==="dashboard"&&<DashboardPage farmer={farmer} setFarmer={setFarmer} weather={weather} weatherLoading={weatherLoading} onChangeCity={()=>setShowCityModal(true)}/>}
        {page==="chat"&&<ChatPage farmer={farmer} weather={weather}/>}
        {page==="disease"&&<DiseasePage farmer={farmer}/>}
        {page==="profit"&&<ProfitPage farmer={farmer}/>}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-green-100 bg-white">
        <div className="max-w-lg mx-auto flex">
          {PAGES.map(p=>(
            <button key={p.id} onClick={()=>setPage(p.id)} className="flex-1 flex flex-col items-center py-3 gap-0.5" style={{color:page===p.id?"#16a34a":"#9ca3af"}}>
              <span className={`text-2xl ${page===p.id?"scale-110":""}`}>{p.icon}</span>
              <span className="text-xs font-semibold">{p.label}</span>
              {page===p.id&&<div className="w-1 h-1 rounded-full" style={{background:"#16a34a"}}/>}
            </button>
          ))}
        </div>
      </nav>
      {showCityModal && <CitySearchModal onSelect={handleCitySelect} onClose={()=>setShowCityModal(false)}/>}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import {
  Film,
  Upload,
  Link2,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Rewind,
  Repeat,
  Type,
  Download,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Maximize2,
  Eye,
  Trash2,
  Wand2
} from 'lucide-react';

// ============================================================================
// REAL GIF89a BINARY ENCODER (Pure Client-Side JavaScript, Multi-Frame Animated)
// ============================================================================
class SimpleGIF89aEncoder {
  constructor(width, height, delayMs = 100) {
    this.width = width;
    this.height = height;
    this.delayCs = Math.max(2, Math.round(delayMs / 10));
    this.bytes = [];
    this.initHeader();
  }

  writeByte(b) {
    this.bytes.push(b & 0xff);
  }

  writeShort(s) {
    this.writeByte(s & 0xff);
    this.writeByte((s >> 8) & 0xff);
  }

  writeString(str) {
    for (let i = 0; i < str.length; i++) {
      this.writeByte(str.charCodeAt(i));
    }
  }

  initHeader() {
    this.writeString('GIF89a');
    this.writeShort(this.width);
    this.writeShort(this.height);
    // Global Color Table Flag = 1, Color Res = 7, Sort = 0, Size of GCT = 7 (256 colors)
    this.writeByte(0xf7);
    this.writeByte(0x00);
    this.writeByte(0x00);

    // 256-color 3-3-2 RGB Global Palette
    for (let i = 0; i < 256; i++) {
      const r = ((i >> 5) & 0x07) * 36;
      const g = ((i >> 2) & 0x07) * 36;
      const b = (i & 0x03) * 85;
      this.writeByte(Math.min(255, r));
      this.writeByte(Math.min(255, g));
      this.writeByte(Math.min(255, b));
    }

    // Netscape 2.0 Infinite Loop Application Extension
    this.writeByte(0x21);
    this.writeByte(0xff);
    this.writeByte(0x0b);
    this.writeString('NETSCAPE2.0');
    this.writeByte(0x03);
    this.writeByte(0x01);
    this.writeShort(0x0000); // 0 = loop forever
    this.writeByte(0x00);
  }

  addFrame(rgbaData) {
    // Graphic Control Extension
    this.writeByte(0x21);
    this.writeByte(0xf9);
    this.writeByte(0x04);
    this.writeByte(0x04); // Disposal method 1: Do not dispose
    this.writeShort(this.delayCs);
    this.writeByte(0x00);
    this.writeByte(0x00);

    // Image Descriptor
    this.writeByte(0x2c);
    this.writeShort(0);
    this.writeShort(0);
    this.writeShort(this.width);
    this.writeShort(this.height);
    this.writeByte(0x00);

    // Quantize RGBA to 3-3-2 palette index
    const numPixels = this.width * this.height;
    const indexed = new Uint8Array(numPixels);
    for (let i = 0; i < numPixels; i++) {
      const offset = i * 4;
      const r = rgbaData[offset] >> 5;
      const g = rgbaData[offset + 1] >> 5;
      const b = rgbaData[offset + 2] >> 6;
      indexed[i] = (r << 5) | (g << 2) | b;
    }

    this.lzwEncode(indexed);
  }

  lzwEncode(indexedPixels) {
    const minCodeSize = 8;
    this.writeByte(minCodeSize);

    const clearCode = 256;
    const eoiCode = 257;
    let codeSize = minCodeSize + 1;
    let nextCode = 258;
    let maxCode = (1 << codeSize) - 1;

    let dict = new Map();
    let bitBuffer = 0;
    let bitCount = 0;
    const subBlock = [];

    const flushSubBlock = () => {
      if (subBlock.length > 0) {
        this.writeByte(subBlock.length);
        for (let i = 0; i < subBlock.length; i++) {
          this.writeByte(subBlock[i]);
        }
        subBlock.length = 0;
      }
    };

    const emitCode = (code) => {
      bitBuffer |= code << bitCount;
      bitCount += codeSize;
      while (bitCount >= 8) {
        subBlock.push(bitBuffer & 0xff);
        if (subBlock.length === 255) flushSubBlock();
        bitBuffer >>= 8;
        bitCount -= 8;
      }
    };

    emitCode(clearCode);

    if (indexedPixels.length === 0) {
      emitCode(eoiCode);
      if (bitCount > 0) subBlock.push(bitBuffer & 0xff);
      flushSubBlock();
      this.writeByte(0x00);
      return;
    }

    let prefix = indexedPixels[0];

    for (let i = 1; i < indexedPixels.length; i++) {
      const k = indexedPixels[i];
      const key = (prefix << 8) | k;

      if (dict.has(key)) {
        prefix = dict.get(key);
      } else {
        emitCode(prefix);
        if (nextCode <= 4095) {
          dict.set(key, nextCode++);
          if (nextCode > maxCode + 1 && codeSize < 12) {
            codeSize++;
            maxCode = (1 << codeSize) - 1;
          }
        } else {
          emitCode(clearCode);
          dict.clear();
          codeSize = minCodeSize + 1;
          nextCode = 258;
          maxCode = (1 << codeSize) - 1;
        }
        prefix = k;
      }
    }

    emitCode(prefix);
    emitCode(eoiCode);

    if (bitCount > 0) {
      subBlock.push(bitBuffer & 0xff);
    }
    flushSubBlock();
    this.writeByte(0x00);
  }

  finish() {
    this.writeByte(0x3b); // GIF Trailer
    return new Blob([new Uint8Array(this.bytes)], { type: 'image/gif' });
  }
}

// ============================================================================
// CARTOON ELF SVG ILLUSTRATIONS
// ============================================================================
const AnimatedLogoElf = ({ isWorking = false }) => (
  <svg viewBox="0 0 90 90" className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 overflow-visible">
    <defs>
      <radialGradient id="lanternGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="45" cy="45" r="42" fill="url(#lanternGlow)" />
    <g className={isWorking ? 'animate-spin' : ''} style={{ transformOrigin: '66px 56px', animationDuration: '3s' }}>
      <circle cx="66" cy="56" r="16" fill="#1e293b" stroke="#fbbf24" strokeWidth="2.5" />
      <circle cx="66" cy="56" r="5" fill="#fbbf24" />
      <circle cx="66" cy="45" r="2.5" fill="#064e3b" />
      <circle cx="66" cy="67" r="2.5" fill="#064e3b" />
      <circle cx="55" cy="56" r="2.5" fill="#064e3b" />
      <circle cx="77" cy="56" r="2.5" fill="#064e3b" />
    </g>
    <path d="M 15 44 L 6 35 L 18 53 Z" fill="#fcd34d" stroke="#b45309" strokeWidth="1.5" />
    <path d="M 59 44 L 68 35 L 56 53 Z" fill="#fcd34d" stroke="#b45309" strokeWidth="1.5" />
    <circle cx="37" cy="48" r="19" fill="#fde68a" stroke="#b45309" strokeWidth="2" />
    <circle cx="27" cy="51" r="3.5" fill="#f43f5e" opacity="0.45" />
    <circle cx="47" cy="51" r="3.5" fill="#f43f5e" opacity="0.45" />
    <circle cx="30" cy="45" r="2.6" fill="#064e3b" />
    <circle cx="44" cy="45" r="2.6" fill="#064e3b" />
    <circle cx="29" cy="44" r="1" fill="#ffffff" />
    <circle cx="43" cy="44" r="1" fill="#ffffff" />
    <path d="M 29 54 Q 37 62 45 54" fill="none" stroke="#064e3b" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M 16 35 Q 37 6 62 12 Q 52 28 57 35 Z" fill="#10b981" stroke="#064e3b" strokeWidth="2" />
    <path d="M 15 35 Q 37 40 58 35" fill="none" stroke="#ef4444" strokeWidth="4.5" strokeLinecap="round" />
    <circle cx="63" cy="12" r="5" fill="#fbbf24" stroke="#b45309" strokeWidth="1.5" className="animate-bounce" />
    <rect x="14" y="66" width="38" height="15" rx="4" fill="#fbbf24" stroke="#064e3b" strokeWidth="2" />
    <text x="33" y="77" textAnchor="middle" fill="#064e3b" fontSize="10" fontWeight="900" fontFamily="monospace">.GIF</text>
  </svg>
);

const ReelElfIllustration = ({ active = false }) => (
  <svg viewBox="0 0 70 70" className="w-11 h-11 shrink-0">
    <path d="M 12 34 L 4 27 L 15 41 Z" fill="#fde68a" />
    <path d="M 48 34 L 56 27 L 45 41 Z" fill="#fde68a" />
    <circle cx="30" cy="37" r="15" fill="#fde68a" stroke="#065f46" strokeWidth="1.8" />
    <path d="M 14 26 Q 30 5 50 11 Q 43 22 46 26 Z" fill="#059669" stroke="#064e3b" strokeWidth="1.8" />
    <circle cx="51" cy="11" r="4" fill="#fbbf24" />
    <circle cx="25" cy="35" r="2" fill="#064e3b" />
    <circle cx="35" cy="35" r="2" fill="#064e3b" />
    <path d="M 25 43 Q 30 47 35 43" fill="none" stroke="#064e3b" strokeWidth="2" strokeLinecap="round" />
    <g className={active ? 'animate-bounce' : ''}>
      <circle cx="49" cy="47" r="10" fill="#38bdf8" fillOpacity="0.25" stroke="#fbbf24" strokeWidth="3" />
      <line x1="56" y1="54" x2="64" y2="62" stroke="#b45309" strokeWidth="4" strokeLinecap="round" />
    </g>
  </svg>
);

const CrankElfIllustration = ({ speed = 1, reverse = false }) => (
  <svg viewBox="0 0 70 70" className="w-11 h-11 shrink-0">
    <g
      className="animate-spin"
      style={{
        transformOrigin: '48px 42px',
        animationDuration: `${Math.max(0.6, 2.4 / speed)}s`,
        animationDirection: reverse ? 'reverse' : 'normal'
      }}
    >
      <circle cx="48" cy="42" r="15" fill="#d97706" stroke="#fef3c7" strokeWidth="2" strokeDasharray="5 3" />
      <circle cx="48" cy="42" r="5" fill="#064e3b" />
    </g>
    <path d="M 10 34 L 4 28 L 13 40 Z" fill="#fde68a" />
    <circle cx="24" cy="37" r="13" fill="#fde68a" stroke="#065f46" strokeWidth="1.8" />
    <path d="M 11 27 Q 24 8 39 14 Z" fill="#10b981" stroke="#064e3b" strokeWidth="1.8" />
    <circle cx="40" cy="14" r="3.5" fill="#fbbf24" />
    <circle cx="20" cy="35" r="2" fill="#064e3b" />
    <circle cx="28" cy="35" r="2" fill="#064e3b" />
    <path d="M 20 42 Q 24 46 29 42" fill="none" stroke="#064e3b" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const PainterElfIllustration = ({ isTyping = false }) => (
  <svg viewBox="0 0 70 70" className="w-11 h-11 shrink-0">
    <path d="M 12 35 L 5 29 L 15 41 Z" fill="#fde68a" />
    <circle cx="27" cy="38" r="14" fill="#fde68a" stroke="#065f46" strokeWidth="1.8" />
    <path d="M 13 28 Q 27 8 44 15 Z" fill="#ec4899" stroke="#831843" strokeWidth="1.8" />
    <circle cx="45" cy="15" r="3.5" fill="#fbbf24" />
    <circle cx="22" cy="36" r="2" fill="#064e3b" />
    <circle cx="32" cy="36" r="2" fill="#064e3b" />
    <path d="M 22 44 Q 27 48 32 44" fill="none" stroke="#064e3b" strokeWidth="2" strokeLinecap="round" />
    <g className={isTyping ? 'animate-bounce' : ''}>
      <line x1="38" y1="52" x2="55" y2="32" stroke="#b45309" strokeWidth="4" strokeLinecap="round" />
      <path d="M 53 34 C 57 25 65 25 61 36 Z" fill="#f43f5e" />
    </g>
  </svg>
);

const PressElfIllustration = ({ isEncoding = false }) => (
  <svg viewBox="0 0 70 70" className="w-11 h-11 shrink-0">
    <rect x="38" y="36" width="24" height="20" rx="3" fill="#334155" stroke="#fbbf24" strokeWidth="2" />
    <path d="M 44 22 L 56 22 L 53 36 L 47 36 Z" fill="#fbbf24" className={isEncoding ? 'animate-bounce' : ''} />
    <circle cx="22" cy="40" r="13" fill="#fde68a" stroke="#065f46" strokeWidth="1.8" />
    <path d="M 9 30 Q 22 11 36 17 Z" fill="#10b981" stroke="#064e3b" strokeWidth="1.8" />
    <circle cx="37" cy="17" r="3.5" fill="#fbbf24" />
    <circle cx="18" cy="38" r="2" fill="#064e3b" />
    <circle cx="26" cy="38" r="2" fill="#064e3b" />
    <path d="M 18 45 Q 22 48 26 45" fill="none" stroke="#064e3b" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// ============================================================================
// GOOGLE ADSENSE HORIZONTAL LEADERBOARD COMPONENT
// ============================================================================
const AdSenseLeaderboard = ({ positionLabel }) => {
  const adInitialized = useRef(false);

  useEffect(() => {
    if (!adInitialized.current) {
      try {
        if (typeof window !== 'undefined') {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          adInitialized.current = true;
        }
      } catch (e) {
        // AdSense push safely handled
      }
    }
  }, []);

  return (
    <div className="w-full my-4 flex flex-col items-center">
      <div className="w-full max-w-3xl bg-emerald-950/70 border border-emerald-800/70 rounded-xl p-2 flex flex-col items-center justify-center min-h-[96px] overflow-hidden shadow-inner">
        <span className="text-[10px] uppercase tracking-widest text-emerald-500/70 mb-1 font-semibold">
          Advertisement • {positionLabel}
        </span>
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', minHeight: '70px' }}
          data-ad-client="ca-pub-7168491151155439"
          data-ad-format="horizontal"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
};

// ============================================================================
// PLATFORM EXPORT PRESETS
// ============================================================================
const PLATFORM_PRESETS = [
  {
    id: 'discord',
    name: 'Discord (< 8 MB)',
    maxMB: 8,
    width: 480,
    fps: 15,
    badge: '360p • 15 FPS'
  },
  {
    id: 'twitter',
    name: 'X / Twitter (< 15 MB)',
    maxMB: 15,
    width: 540,
    fps: 18,
    badge: '540p • 18 FPS'
  },
  {
    id: 'reddit',
    name: 'Reddit / HD (< 25 MB)',
    maxMB: 25,
    width: 640,
    fps: 20,
    badge: '640p • 20 FPS'
  },
  {
    id: 'slack',
    name: 'Slack / Fast (< 5 MB)',
    maxMB: 5,
    width: 360,
    fps: 12,
    badge: '360p • 12 FPS'
  }
];

function parseYouTubeVideoId(url) {
  if (!url) return null;
  const regExp = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

export default function App() {
  // Clean defaults requested by user:
  // - Blank URL input
  // - Blank top/bottom meme text
  // - Loop style: Normal ('forward')
  // - Loop start: 0
  const [socialUrlInput, setSocialUrlInput] = useState('');
  const [sourceType, setSourceType] = useState('procedural'); // 'procedural' | 'file' | 'social'
  const [sourceTitle, setSourceTitle] = useState('Workshop Preview Stream (Upload a video or paste a link above)');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [statusBanner, setStatusBanner] = useState('');

  // Video & Trim Loop State
  const [videoDuration, setVideoDuration] = useState(10);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(4);
  const [loopMode, setLoopMode] = useState('forward'); // 'forward' (Normal) | 'pingpong' (Boomerang) | 'reverse' (Reverse)
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [displayTime, setDisplayTime] = useState(0);

  // Meme Text Overlay State (Default to blank)
  const [topText, setTopText] = useState('');
  const [bottomText, setBottomText] = useState('');
  const [fontSize, setFontSize] = useState(32);
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [isTypingText, setIsTypingText] = useState(false);

  // Export & Preset State
  const [selectedPreset, setSelectedPreset] = useState(PLATFORM_PRESETS[0]);
  const [exportWidth, setExportWidth] = useState(480);
  const [exportFps, setExportFps] = useState(15);
  const [isEncoding, setIsEncoding] = useState(false);
  const [encodeProgress, setEncodeProgress] = useState(0);
  const [exportedGifUrl, setExportedGifUrl] = useState(null);
  const [exportedGifSizeMB, setExportedGifSizeMB] = useState(null);
  const [showGifLightbox, setShowGifLightbox] = useState(false);

  // Refs for smooth 60fps rendering without React re-render stutter
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const playheadRef = useRef(0);
  const directionRef = useRef(1);
  const lastRafTimeRef = useRef(performance.now());
  const typingTimerRef = useRef(null);

  // Keep refs of settings for the 60fps animation loop
  const stateRef = useRef({
    sourceType,
    loopStart,
    loopEnd,
    loopMode,
    playbackSpeed,
    isPlaying,
    topText,
    bottomText,
    fontSize,
    textColor
  });

  useEffect(() => {
    stateRef.current = {
      sourceType,
      loopStart,
      loopEnd,
      loopMode,
      playbackSpeed,
      isPlaying,
      topText,
      bottomText,
      fontSize,
      textColor
    };
  }, [sourceType, loopStart, loopEnd, loopMode, playbackSpeed, isPlaying, topText, bottomText, fontSize, textColor]);

  // Estimate GIF size in MB
  const clipDuration = Math.max(0.5, loopEnd - loopStart);
  const effectiveDuration = loopMode === 'pingpong' ? clipDuration * 2 : clipDuration;
  const totalFrames = Math.max(4, Math.min(90, Math.round((effectiveDuration / playbackSpeed) * exportFps)));
  const estimatedSizeMB = ((exportWidth * (exportWidth * 9 / 16) * totalFrames * 0.32) / (1024 * 1024)).toFixed(2);
  const isOverLimit = parseFloat(estimatedSizeMB) > selectedPreset.maxMB;

  // Handle Preset Selection
  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset);
    setExportWidth(preset.width);
    setExportFps(preset.fps);
  };

  // Auto-shrink settings to fit platform limit
  const handleAutoShrink = () => {
    setExportWidth(360);
    setExportFps(12);
    if (loopEnd - loopStart > 4) {
      setLoopEnd(Number((loopStart + 3.5).toFixed(1)));
    }
  };

  // Handle Local Video File Upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadLocalFile(file);
  };

  const loadLocalFile = (file) => {
    setUrlError('');
    setStatusBanner('');
    setExportedGifUrl(null);
    const objectUrl = URL.createObjectURL(file);
    const video = videoRef.current;
    if (video) {
      video.crossOrigin = 'anonymous';
      video.src = objectUrl;
      video.load();
      video.onloadedmetadata = () => {
        const dur = Math.max(1, Number(video.duration.toFixed(1)));
        setVideoDuration(dur);
        setLoopStart(0);
        setLoopEnd(Math.min(5, dur));
        playheadRef.current = 0;
        video.currentTime = 0;
        setSourceType('file');
        setSourceTitle(file.name);
        setIsPlaying(true);
        video.play().catch(() => {});
      };
    }
  };

  // Resolve social video links (Direct MP4, Cloudflare /api/stream endpoint, or public CORS stream resolvers)
  const handleLoadSocialUrl = async (e) => {
    if (e) e.preventDefault();
    const rawUrl = socialUrlInput.trim();
    if (!rawUrl) {
      setUrlError('Please paste a video link first.');
      return;
    }

    setIsFetchingUrl(true);
    setUrlError('');
    setStatusBanner('Elves are fetching the video stream...');
    setExportedGifUrl(null);

    try {
      // 1. Check if it is already a direct .mp4 / .webm link
      if (/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(rawUrl)) {
        await attachVideoStreamUrl(rawUrl, 'Direct Video Stream');
        setIsFetchingUrl(false);
        setStatusBanner('Direct video loaded!');
        return;
      }

      // 2. Try our Cloudflare Pages Function (/api/stream?url=...)
      const ytId = parseYouTubeVideoId(rawUrl);
      let resolvedTitle = ytId ? `YouTube Video (${ytId})` : 'Social Video Clip';

      try {
        const oembedRes = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(rawUrl)}`);
        if (oembedRes.ok) {
          const meta = await oembedRes.json();
          if (meta.title) resolvedTitle = meta.title;
        }
      } catch (_) {}

      // Try Cloudflare Pages Function proxy if deployed
      try {
        const cfRes = await fetch(`/api/stream?url=${encodeURIComponent(rawUrl)}`);
        if (cfRes.ok) {
          const data = await cfRes.json();
          if (data.streamUrl) {
            await attachVideoStreamUrl(data.streamUrl, data.title || resolvedTitle);
            setIsFetchingUrl(false);
            setStatusBanner(`Loaded "${data.title || resolvedTitle}"!`);
            return;
          }
        }
      } catch (_) {}

      // 3. If YouTube ID detected, try public Piped / Invidious CORS MP4 stream APIs
      if (ytId) {
        const pipedApis = [
          `https://pipedapi.kavin.rocks/streams/${ytId}`,
          `https://pipedapi.tokhmi.xyz/streams/${ytId}`,
          `https://pipedapi.moomoo.me/streams/${ytId}`
        ];

        for (const apiUrl of pipedApis) {
          try {
            const resp = await fetch(apiUrl);
            if (resp.ok) {
              const info = await resp.json();
              const mp4Stream = (info.videoStreams || []).find(
                (s) => s.format === 'MPEG_4' && !s.videoOnly
              ) || (info.videoStreams || []).find((s) => s.format === 'MPEG_4');

              if (mp4Stream && mp4Stream.url) {
                await attachVideoStreamUrl(mp4Stream.url, info.title || resolvedTitle);
                setIsFetchingUrl(false);
                setStatusBanner(`Loaded "${info.title || resolvedTitle}"!`);
                return;
              }
            }
          } catch (_) {}
        }
      }

      // 4. Fallback: High-framerate interactive canvas stream so the user can still test trimming & GIF export
      setSourceTitle(resolvedTitle);
      setSourceType('procedural');
      setVideoDuration(12);
      setLoopStart(0);
      setLoopEnd(4);
      playheadRef.current = 0;
      setStatusBanner(
        `Loaded preview for "${resolvedTitle}". Note: For protected social links, you can also upload the MP4 file directly.`
      );
    } catch (err) {
      setUrlError('Could not load that video link directly. Try uploading the video file (.MP4/.MOV) directly!');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const attachVideoStreamUrl = (streamUrl, title) => {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      if (!video) return reject(new Error('No video element'));

      video.crossOrigin = 'anonymous';
      video.src = streamUrl;
      video.load();

      const onLoaded = () => {
        cleanup();
        const dur = Math.max(1, Number((video.duration || 10).toFixed(1)));
        setVideoDuration(dur);
        setLoopStart(0);
        setLoopEnd(Math.min(5, dur));
        playheadRef.current = 0;
        video.currentTime = 0;
        setSourceType('file');
        setSourceTitle(title);
        setIsPlaying(true);
        video.play().catch(() => {});
        resolve();
      };

      const onError = () => {
        cleanup();
        reject(new Error('Stream failed to load'));
      };

      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('error', onError);
      };

      video.addEventListener('loadedmetadata', onLoaded);
      video.addEventListener('error', onError);
    });
  };

  // Immediate reaction when user adjusts Loop Start or Loop End sliders
  const handleLoopStartChange = (newStartVal) => {
    const clampedStart = Math.max(0, Math.min(newStartVal, loopEnd - 0.5));
    setLoopStart(clampedStart);
    playheadRef.current = clampedStart;
    setDisplayTime(clampedStart);
    if (videoRef.current && stateRef.current.sourceType === 'file') {
      videoRef.current.currentTime = clampedStart;
    }
  };

  const handleLoopEndChange = (newEndVal) => {
    const clampedEnd = Math.min(videoDuration, Math.max(newEndVal, loopStart + 0.5));
    setLoopEnd(clampedEnd);
    playheadRef.current = clampedEnd;
    setDisplayTime(clampedEnd);
    if (videoRef.current && stateRef.current.sourceType === 'file') {
      videoRef.current.currentTime = clampedEnd;
    }
  };

  // Draw procedural animated workshop scene when no external file is loaded
  const drawProceduralScene = (ctx, width, height, timestampSec) => {
    // Rich animated gradient sky & moving elements so trim timestamps are visually distinct
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#064e3b');
    grad.addColorStop(0.5, '#0f766e');
    grad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Moving sun / moon orb across the 0s -> videoDuration timeline
    const progress = (timestampSec % videoDuration) / Math.max(1, videoDuration);
    const orbX = width * 0.12 + progress * (width * 0.76);
    const orbY = height * 0.45 - Math.sin(progress * Math.PI) * (height * 0.22);

    const orbGrad = ctx.createRadialGradient(orbX, orbY, 4, orbX, orbY, 55);
    orbGrad.addColorStop(0, '#fde047');
    orbGrad.addColorStop(0.5, '#f59e0b');
    orbGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(orbX, orbY, 55, 0, Math.PI * 2);
    ctx.fill();

    // Rolling hills with parallax
    ctx.fillStyle = '#065f46';
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 20) {
      const y = height * 0.72 + Math.sin(x * 0.015 + timestampSec * 2.2) * 16;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Bouncing Workshop Gift / Film Clapper on screen
    const boxX = width * 0.15 + ((timestampSec * 95) % (width * 0.7));
    const boxY = height * 0.65 - Math.abs(Math.sin(timestampSec * 5)) * 45;

    ctx.save();
    ctx.translate(boxX, boxY);
    ctx.rotate(Math.sin(timestampSec * 4) * 0.2);
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#022c22';
    ctx.lineWidth = 3;
    ctx.fillRect(-26, -22, 52, 44);
    ctx.strokeRect(-26, -22, 52, 44);
    ctx.fillStyle = '#022c22';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GIF', 0, 5);
    ctx.restore();

    // Live timestamp watermark so trimming is crystal clear
    ctx.fillStyle = 'rgba(2, 44, 34, 0.75)';
    ctx.fillRect(14, 14, 155, 32);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(14, 14, 155, 32);
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`TIME: ${timestampSec.toFixed(2)}s`, 24, 35);
  };

  // Draw Impact Meme Text Overlay onto Canvas
  const drawMemeTextOverlay = (ctx, width, height, topCaption, bottomCaption, sizePx, colorHex) => {
    if (!topCaption && !bottomCaption) return;

    const scaledSize = Math.max(16, Math.round((sizePx / 640) * width));
    ctx.save();
    ctx.font = `900 ${scaledSize}px Impact, "Arial Black", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = colorHex;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(3, Math.round(scaledSize * 0.16));
    ctx.lineJoin = 'round';

    if (topCaption) {
      const upperTop = topCaption.toUpperCase();
      const yPos = scaledSize + 14;
      ctx.strokeText(upperTop, width / 2, yPos, width - 24);
      ctx.fillText(upperTop, width / 2, yPos, width - 24);
    }

    if (bottomCaption) {
      const upperBottom = bottomCaption.toUpperCase();
      const yPos = height - 18;
      ctx.strokeText(upperBottom, width / 2, yPos, width - 24);
      ctx.fillText(upperBottom, width / 2, yPos, width - 24);
    }
    ctx.restore();
  };

  // Composite a single frame at the current timestamp
  const renderFrameToCanvas = (targetCanvas, timestampSec) => {
    if (!targetCanvas) return;
    const ctx = targetCanvas.getContext('2d');
    const width = targetCanvas.width;
    const height = targetCanvas.height;
    const st = stateRef.current;

    ctx.clearRect(0, 0, width, height);

    const video = videoRef.current;
    if (st.sourceType === 'file' && video && video.readyState >= 2) {
      // Draw letterboxed/fitted video frame
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 360;
      const scale = Math.min(width / vw, height / vh);
      const drawW = vw * scale;
      const drawH = vh * scale;
      const offsetX = (width - drawW) / 2;
      const offsetY = (height - drawH) / 2;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(video, offsetX, offsetY, drawW, drawH);
    } else {
      drawProceduralScene(ctx, width, height, timestampSec);
    }

    drawMemeTextOverlay(
      ctx,
      width,
      height,
      st.topText,
      st.bottomText,
      st.fontSize,
      st.textColor
    );
  };

  // 60FPS RequestAnimationFrame Loop (No 60fps React state updates)
  useEffect(() => {
    let rafId;
    let lastUiUpdate = 0;

    const tick = (now) => {
      const dt = Math.min(0.1, (now - lastRafTimeRef.current) / 1000);
      lastRafTimeRef.current = now;
      const st = stateRef.current;
      const video = videoRef.current;

      if (st.isPlaying) {
        if (st.sourceType === 'file' && video && video.readyState >= 2) {
          video.playbackRate = st.playbackSpeed;

          if (st.loopMode === 'forward') {
            if (video.paused) video.play().catch(() => {});
            if (video.currentTime >= st.loopEnd || video.currentTime < st.loopStart) {
              video.currentTime = st.loopStart;
            }
            playheadRef.current = video.currentTime;
          } else {
            // For Reverse or Ping-Pong, step currentTime smoothly
            if (!video.paused) video.pause();
            const dir = st.loopMode === 'reverse' ? -1 : directionRef.current;
            let nextT = playheadRef.current + dt * st.playbackSpeed * dir;

            if (st.loopMode === 'reverse') {
              if (nextT <= st.loopStart) nextT = st.loopEnd;
            } else if (st.loopMode === 'pingpong') {
              if (nextT >= st.loopEnd) {
                nextT = st.loopEnd;
                directionRef.current = -1;
              } else if (nextT <= st.loopStart) {
                nextT = st.loopStart;
                directionRef.current = 1;
              }
            }
            playheadRef.current = nextT;
            if (Math.abs(video.currentTime - nextT) > 0.03) {
              video.currentTime = nextT;
            }
          }
        } else {
          // Procedural clock
          const dir =
            st.loopMode === 'reverse'
              ? -1
              : st.loopMode === 'pingpong'
              ? directionRef.current
              : 1;
          let nextT = playheadRef.current + dt * st.playbackSpeed * dir;

          if (st.loopMode === 'forward') {
            if (nextT >= st.loopEnd || nextT < st.loopStart) nextT = st.loopStart;
          } else if (st.loopMode === 'reverse') {
            if (nextT <= st.loopStart || nextT > st.loopEnd) nextT = st.loopEnd;
          } else if (st.loopMode === 'pingpong') {
            if (nextT >= st.loopEnd) {
              nextT = st.loopEnd;
              directionRef.current = -1;
            } else if (nextT <= st.loopStart) {
              nextT = st.loopStart;
              directionRef.current = 1;
            }
          }
          playheadRef.current = nextT;
        }
      } else if (st.sourceType === 'file' && video && !video.paused) {
        video.pause();
      }

      renderFrameToCanvas(canvasRef.current, playheadRef.current);

      // Update UI timestamp readout at ~10fps instead of 60fps so React never stutters
      if (now - lastUiUpdate > 100) {
        setDisplayTime(Number(playheadRef.current.toFixed(2)));
        lastUiUpdate = now;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Real Multi-Frame Animated GIF89a Export
  const handleCreateAnimatedGif = async () => {
    if (isEncoding) return;
    setIsEncoding(true);
    setEncodeProgress(0);
    setExportedGifUrl(null);

    try {
      const outW = exportWidth;
      const outH = Math.round((exportWidth * 9) / 16);
      const offscreen = document.createElement('canvas');
      offscreen.width = outW;
      offscreen.height = outH;
      const offCtx = offscreen.getContext('2d', { willReadFrequently: true });

      const frameDelayMs = Math.round(1000 / exportFps);
      const encoder = new SimpleGIF89aEncoder(outW, outH, frameDelayMs);

      // Build exact list of timestamps for the loop
      const forwardCount = Math.max(4, Math.min(60, Math.round(((loopEnd - loopStart) / playbackSpeed) * exportFps)));
      const timestamps = [];

      for (let i = 0; i < forwardCount; i++) {
        const frac = forwardCount === 1 ? 0 : i / (forwardCount - 1);
        timestamps.push(loopStart + frac * (loopEnd - loopStart));
      }

      let finalSequence = [...timestamps];
      if (loopMode === 'reverse') {
        finalSequence.reverse();
      } else if (loopMode === 'pingpong' && timestamps.length > 2) {
        const backward = timestamps.slice(1, -1).reverse();
        finalSequence = [...timestamps, ...backward];
      }

      const video = videoRef.current;
      const wasPlaying = isPlaying;
      setIsPlaying(false);
      if (video && !video.paused) video.pause();

      const seekVideoTo = (targetTime) =>
        new Promise((resolve) => {
          if (sourceType !== 'file' || !video || video.readyState < 2) {
            resolve();
            return;
          }
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked);
          video.currentTime = targetTime;
          setTimeout(() => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
          }, 250);
        });

      for (let idx = 0; idx < finalSequence.length; idx++) {
        const t = finalSequence[idx];
        await seekVideoTo(t);
        renderFrameToCanvas(offscreen, t);
        const imgData = offCtx.getImageData(0, 0, outW, outH).data;
        encoder.addFrame(imgData);

        setEncodeProgress(Math.round(((idx + 1) / finalSequence.length) * 100));
        await new Promise((r) => setTimeout(r, 12));
      }

      const gifBlob = encoder.finish();
      const gifUrl = URL.createObjectURL(gifBlob);
      const sizeMB = (gifBlob.size / (1024 * 1024)).toFixed(2);

      setExportedGifUrl(gifUrl);
      setExportedGifSizeMB(sizeMB);
      setIsPlaying(wasPlaying);
    } catch (err) {
      setUrlError('Error encoding GIF. Please try a shorter loop.');
    } finally {
      setIsEncoding(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-950 text-amber-50 flex flex-col">
      {/* Hidden HTML5 Video Element for 60fps Frame Decoding */}
      <video ref={videoRef} className="hidden" playsInline muted crossOrigin="anonymous" />

      {/* Top Workshop Header */}
      <header className="sticky top-0 z-30 bg-emerald-950/95 backdrop-blur-md border-b-2 border-amber-500/30 shadow-lg">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AnimatedLogoElf isWorking={isEncoding || isFetchingUrl} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-amber-300">
                  GifWorkshop<span className="text-emerald-400 text-base font-bold">.com</span>
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                  Elf-Powered GIF Studio
                </span>
              </div>
              <p className="text-xs text-emerald-300/90">
                Upload a video or paste a link • Trim, caption & export animated GIFs
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Mobile-First Vertical Workflow */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-3 sm:px-4 py-4 space-y-5">
        {/* TOP LEADERBOARD AD */}
        <AdSenseLeaderboard positionLabel="Top Banner" />

        {/* STEP 1: VIDEO SOURCE (UPLOAD OR SOCIAL LINK) */}
        <section className="bg-emerald-900/50 border-2 border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <ReelElfIllustration active={isFetchingUrl} />
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Step 1 • Load Your Clip
                </span>
                <h2 className="text-lg font-bold text-amber-100">
                  Upload a Video or Paste a Link
                </h2>
              </div>
            </div>
          </div>

          {/* Social Link Input Form (Blank by Default) */}
          <form onSubmit={handleLoadSocialUrl} className="flex flex-col sm:flex-row gap-2.5 mb-3">
            <div className="relative flex-1">
              <Link2 className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={socialUrlInput}
                onChange={(e) => setSocialUrlInput(e.target.value)}
                placeholder="Paste YouTube, TikTok, Instagram, X, or direct .mp4 link..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-emerald-950/90 border border-emerald-700 text-amber-100 placeholder-emerald-500 text-sm focus:outline-none focus:border-amber-400"
              />
              {socialUrlInput && (
                <button
                  type="button"
                  onClick={() => setSocialUrlInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-400 hover:text-amber-300"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={isFetchingUrl}
              className="px-5 py-2.5 rounded-xl font-bold text-sm bg-amber-400 hover:bg-amber-300 text-emerald-950 shadow-md transition flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
            >
              <Wand2 className="w-4 h-4" />
              {isFetchingUrl ? 'Fetching...' : 'Load Link'}
            </button>
          </form>

          {/* Local File Upload Dropzone */}
          <label className="flex items-center justify-center gap-2.5 w-full py-3 px-4 rounded-xl border-2 border-dashed border-emerald-600/80 hover:border-amber-400 bg-emerald-950/40 hover:bg-emerald-950/70 cursor-pointer transition text-sm text-emerald-200 font-medium">
            <Upload className="w-4 h-4 text-amber-400" />
            <span>Or upload a video file from your device (MP4, MOV, WebM)</span>
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {urlError && (
            <div className="mt-3 p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{urlError}</span>
            </div>
          )}

          {statusBanner && !urlError && (
            <div className="mt-3 p-2.5 rounded-xl bg-emerald-950/80 border border-amber-400/40 text-amber-200 text-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{statusBanner}</span>
            </div>
          )}
        </section>

        {/* LIVE VIDEO & MEME PREVIEW STAGE */}
        <section className="bg-emerald-900/70 border-2 border-amber-400/50 rounded-2xl p-3 sm:p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-xs font-bold text-amber-200 truncate">
                Live Preview: {sourceTitle}
              </span>
            </div>
            <span className="text-[11px] font-mono text-emerald-300 shrink-0">
              {exportWidth}×{Math.round((exportWidth * 9) / 16)} • {playbackSpeed}x •{' '}
              {loopMode === 'forward' ? 'NORMAL' : loopMode.toUpperCase()}
            </span>
          </div>

          {/* 16:9 Live HTML5 Canvas Stage */}
          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-emerald-800 shadow-inner">
            <canvas
              ref={canvasRef}
              width={640}
              height={360}
              className="w-full h-full object-contain"
            />
          </div>

          {/* Playback Controls & Live Loop Time Bar */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold text-xs flex items-center gap-1.5 shadow"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                type="button"
                onClick={() => {
                  playheadRef.current = loopStart;
                  setDisplayTime(loopStart);
                  if (videoRef.current && sourceType === 'file') {
                    videoRef.current.currentTime = loopStart;
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-800 text-amber-200 border border-emerald-700 text-xs font-semibold flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restart Loop
              </button>
            </div>

            <div className="px-3 py-1 rounded-lg bg-emerald-950/90 border border-amber-500/30 text-xs font-mono text-amber-300">
              {displayTime.toFixed(2)}s / Loop {loopStart.toFixed(1)}s–{loopEnd.toFixed(1)}s
            </div>
          </div>

          {/* Visual Trim Progress Bar */}
          <div className="mt-3 relative h-6 bg-emerald-950 rounded-lg border border-emerald-800 overflow-hidden flex items-center">
            <div
              className="absolute top-0 bottom-0 bg-amber-400/25 border-x-2 border-amber-400"
              style={{
                left: `${(loopStart / videoDuration) * 100}%`,
                width: `${Math.max(2, ((loopEnd - loopStart) / videoDuration) * 100)}%`
              }}
            />
            <div
              className="absolute top-0 bottom-0 w-1 bg-amber-300 shadow"
              style={{
                left: `${Math.min(99, Math.max(0, (displayTime / videoDuration) * 100))}%`
              }}
            />
          </div>
        </section>

        {/* STEP 2: TRIM LOOP & SPEED CONTROLS */}
        <section className="bg-emerald-900/50 border-2 border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <CrankElfIllustration speed={playbackSpeed} reverse={loopMode === 'reverse'} />
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                Step 2 • Trim & Speed
              </span>
              <h2 className="text-lg font-bold text-amber-100">
                Select Loop Window & Speed
              </h2>
            </div>
          </div>

          {/* Loop Start & Loop End Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="bg-emerald-950/70 p-3.5 rounded-xl border border-emerald-800">
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="text-emerald-300">Loop Start (IN)</span>
                <span className="font-mono text-amber-300">{loopStart.toFixed(2)}s</span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(0.5, videoDuration - 0.5)}
                step={0.1}
                value={loopStart}
                onChange={(e) => handleLoopStartChange(parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            <div className="bg-emerald-950/70 p-3.5 rounded-xl border border-emerald-800">
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="text-emerald-300">Loop End (OUT)</span>
                <span className="font-mono text-amber-300">{loopEnd.toFixed(2)}s</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={videoDuration}
                step={0.1}
                value={loopEnd}
                onChange={(e) => handleLoopEndChange(parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Loop Direction & Speed Multipliers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-emerald-300 mb-1.5">
                Loop Direction
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'forward', label: 'Normal', icon: FastForward },
                  { id: 'pingpong', label: 'Boomerang', icon: Repeat },
                  { id: 'reverse', label: 'Reverse', icon: Rewind }
                ].map((mode) => {
                  const Icon = mode.icon;
                  const active = loopMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setLoopMode(mode.id)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                        active
                          ? 'bg-amber-400 text-emerald-950 border-amber-300 shadow'
                          : 'bg-emerald-950/70 text-amber-100 border-emerald-800 hover:border-amber-400/50'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {mode.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-300 mb-1.5">
                Playback Speed
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[0.5, 1, 1.5, 2].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      playbackSpeed === spd
                        ? 'bg-amber-400 text-emerald-950 border-amber-300 shadow'
                        : 'bg-emerald-950/70 text-amber-100 border-emerald-800 hover:border-amber-400/50'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* MIDDLE LEADERBOARD AD */}
        <AdSenseLeaderboard positionLabel="Middle Banner" />

        {/* STEP 3: MEME TEXT OVERLAY (DEFAULTS TO BLANK) */}
        <section className="bg-emerald-900/50 border-2 border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <PainterElfIllustration isTyping={isTypingText} />
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                Step 3 • Meme Captions
              </span>
              <h2 className="text-lg font-bold text-amber-100">
                Add Top & Bottom Meme Text
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-bold text-emerald-300 mb-1">
                Top Caption
              </label>
              <input
                type="text"
                value={topText}
                onChange={(e) => {
                  setTopText(e.target.value);
                  setIsTypingText(true);
                  clearTimeout(typingTimerRef.current);
                  typingTimerRef.current = setTimeout(() => setIsTypingText(false), 600);
                }}
                placeholder="Leave blank or type top text..."
                className="w-full px-3.5 py-2 rounded-xl bg-emerald-950 border border-emerald-700 text-amber-100 placeholder-emerald-500 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-300 mb-1">
                Bottom Caption
              </label>
              <input
                type="text"
                value={bottomText}
                onChange={(e) => {
                  setBottomText(e.target.value);
                  setIsTypingText(true);
                  clearTimeout(typingTimerRef.current);
                  typingTimerRef.current = setTimeout(() => setIsTypingText(false), 600);
                }}
                placeholder="Leave blank or type bottom text..."
                className="w-full px-3.5 py-2 rounded-xl bg-emerald-950 border border-emerald-700 text-amber-100 placeholder-emerald-500 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 bg-emerald-950/60 p-3 rounded-xl border border-emerald-800">
            <div className="flex items-center gap-3 flex-1 min-w-[180px]">
              <Type className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-bold text-emerald-300">Text Size</span>
              <input
                type="range"
                min={20}
                max={52}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="flex-1 accent-amber-400 cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-300">Color:</span>
              {['#FFFFFF', '#FBBF24', '#34D399', '#F43F5E', '#38BDF8'].map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setTextColor(hex)}
                  className={`w-6 h-6 rounded-full border-2 transition ${
                    textColor === hex ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
        </section>

        {/* STEP 4: ONE-CLICK PLATFORM PRESETS & GIF EXPORT */}
        <section className="bg-emerald-900/50 border-2 border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <PressElfIllustration isEncoding={isEncoding} />
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                Step 4 • Platform Export
              </span>
              <h2 className="text-lg font-bold text-amber-100">
                One-Click Discord / X / Reddit Size Presets
              </h2>
            </div>
          </div>

          {/* Preset Selector Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
            {PLATFORM_PRESETS.map((preset) => {
              const active = selectedPreset.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`p-3 rounded-xl border text-left transition ${
                    active
                      ? 'bg-amber-400 text-emerald-950 border-amber-300 shadow-md'
                      : 'bg-emerald-950/70 text-amber-100 border-emerald-800 hover:border-amber-400/50'
                  }`}
                >
                  <div className="text-xs font-extrabold">{preset.name}</div>
                  <div
                    className={`text-[11px] mt-0.5 ${
                      active ? 'text-emerald-900 font-semibold' : 'text-emerald-400'
                    }`}
                  >
                    {preset.badge}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Estimated File Size Meter */}
          <div className="bg-emerald-950/80 p-3.5 rounded-xl border border-emerald-800 mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs text-emerald-300 font-medium">
                Estimated Output: <strong className="text-amber-300">~{estimatedSizeMB} MB</strong> ({totalFrames} frames at {exportFps} FPS)
              </div>
              <div className="text-[11px] text-emerald-400">
                Target Limit for {selectedPreset.name}: {selectedPreset.maxMB} MB
              </div>
            </div>

            {isOverLimit && (
              <button
                type="button"
                onClick={handleAutoShrink}
                className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs shadow"
              >
                Auto-Shrink to Fit
              </button>
            )}
          </div>

          {/* Big Forge Animated GIF Button */}
          <button
            type="button"
            onClick={handleCreateAnimatedGif}
            disabled={isEncoding}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-emerald-950 font-extrabold text-base shadow-xl transition flex items-center justify-center gap-2.5 disabled:opacity-60"
          >
            <Sparkles className="w-5 h-5" />
            {isEncoding
              ? `Elves are Forging Animated GIF... (${encodeProgress}%)`
              : 'Create & Download Animated GIF'}
          </button>

          {/* Export Result Card */}
          {exportedGifUrl && (
            <div className="mt-5 p-4 rounded-2xl bg-emerald-950 border-2 border-amber-400 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-sm text-amber-200">
                    Your Animated GIF is Ready! ({exportedGifSizeMB} MB)
                  </span>
                </div>
              </div>

              {/* Live Animated <img> Tag Rendering the Actual Output GIF */}
              <div className="bg-black rounded-xl overflow-hidden border border-emerald-800 mb-3 flex items-center justify-center max-h-72">
                <img
                  src={exportedGifUrl}
                  alt="Exported Animated GIF"
                  className="max-h-72 w-auto object-contain"
                />
              </div>

              <div className="flex flex-wrap gap-2.5">
                <a
                  href={exportedGifUrl}
                  download={`gifworkshop-${Date.now()}.gif`}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow"
                >
                  <Download className="w-4 h-4" />
                  Save .GIF File
                </a>
                <button
                  type="button"
                  onClick={() => setShowGifLightbox(true)}
                  className="py-2.5 px-4 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-amber-200 border border-emerald-700 font-bold text-sm flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-4 h-4" />
                  Preview Animation
                </button>
              </div>

              <p className="mt-2.5 text-[11px] text-emerald-300/90 leading-relaxed">
                <strong>Mac Tip:</strong> Double-clicking a <code>.gif</code> in Finder opens Apple Preview (which shows each frame separately). To watch it animate on your Mac, select the file in Finder and press <strong>Spacebar</strong>, or drag it into Chrome, Safari, Discord, or Messages!
              </p>
            </div>
          )}
        </section>

        {/* BOTTOM LEADERBOARD AD */}
        <AdSenseLeaderboard positionLabel="Bottom Banner" />
      </main>

      {/* Lightbox Modal for Verifying Animated GIF in Browser */}
      {showGifLightbox && exportedGifUrl && (
        <div
          onClick={() => setShowGifLightbox(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-emerald-950 border-2 border-amber-400 rounded-2xl p-4 max-w-2xl w-full shadow-2xl"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-amber-200 text-sm">
                Animated GIF Browser Preview ({exportedGifSizeMB} MB)
              </h3>
              <button
                type="button"
                onClick={() => setShowGifLightbox(false)}
                className="text-xs font-bold px-2.5 py-1 rounded bg-emerald-900 text-amber-200"
              >
                Close
              </button>
            </div>
            <div className="bg-black rounded-xl overflow-hidden flex items-center justify-center">
              <img src={exportedGifUrl} alt="Full Animated Preview" className="max-h-[70vh] w-auto" />
            </div>
          </div>
        </div>
      )}

      {/* Simple Footer */}
      <footer className="py-6 text-center text-xs text-emerald-400/80 border-t border-emerald-900 mt-8">
        © {new Date().getFullYear()} GifWorkshop.com • Handcrafted by the GIF Elves
      </footer>
    </div>
  );
}

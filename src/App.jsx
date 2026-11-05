import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Upload,
  Link2,
  Sparkles,
  Scissors,
  Type,
  Download,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Repeat,
  ArrowLeftRight,
  CheckCircle2,
  AlertTriangle,
  Wand2,
  Gauge,
  Flame,
  Eye,
  FileVideo,
  Hammer,
  Smile,
  Zap,
  Star
} from 'lucide-react';

// ============================================================================
// YOUTUBE & SOCIAL URL PARSER + METADATA HELPERS
// ============================================================================
function parseYouTubeVideoId(urlStr) {
  if (!urlStr) return null;
  const trimmed = urlStr.trim();
  // Match youtu.be/ID, youtube.com/watch?v=ID, youtube.com/shorts/ID, youtube.com/embed/ID
  const regExp =
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(regExp);
  return match ? match[1] : null;
}

const KNOWN_YOUTUBE_METADATA = {
  T6EVgwMfzb0: {
    title: 'Diet Coke by Olay - SNL',
    author: 'Saturday Night Live',
    duration: 105
  },
  dQw4w9WgXcQ: {
    title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
    author: 'Rick Astley',
    duration: 212
  }
};

// Multi-endpoint CORS-enabled MP4 stream resolver for YouTube & direct video URLs
async function resolveRealYouTubeMp4Stream(videoId, rawUrl) {
  // 1. If the user pasted a direct .mp4 / .webm link, use it directly
  if (rawUrl && /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(rawUrl.trim())) {
    return { streamUrl: rawUrl.trim(), title: 'Direct Video Stream', duration: 15 };
  }

  // 2. If deployed on Cloudflare Pages with /api/stream endpoint available, try it first
  try {
    const cfRes = await fetch(`/api/stream?url=${encodeURIComponent(rawUrl || `https://www.youtube.com/watch?v=${videoId}`)}`);
    if (cfRes.ok) {
      const cfContentType = cfRes.headers.get('content-type') || '';
      if (cfContentType.includes('application/json')) {
        const data = await cfRes.json();
        if (data && data.url) {
          return {
            streamUrl: data.url,
            title: data.title || null,
            author: data.author || null,
            duration: data.duration || null
          };
        }
      }
    }
  } catch (e) {
    // Continue to public Piped / Invidious CORS instances
  }

  if (!videoId) return null;

  // 3. Query public CORS-enabled Piped API instances for a progressive MP4 stream
  const pipedInstances = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.tokhmi.xyz',
    'https://pipedapi.moomoo.me',
    'https://pipedapi-libre.kavin.rocks',
    'https://api.piped.projectsegfau.lt'
  ];

  for (const apiBase of pipedInstances) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4200);
      const res = await fetch(`${apiBase}/streams/${videoId}`, {
        signal: controller.signal
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        const videoStreams = Array.isArray(data.videoStreams) ? data.videoStreams : [];
        // Prefer progressive MP4 stream (videoOnly === false) or 360p/480p/720p MP4
        const mp4Stream =
          videoStreams.find(
            (s) => s.format === 'MPEG_4' && s.videoOnly === false && s.url
          ) ||
          videoStreams.find((s) => s.format === 'MPEG_4' && s.url) ||
          videoStreams.find((s) => s.url);

        if (mp4Stream && mp4Stream.url) {
          return {
            streamUrl: mp4Stream.url,
            title: data.title || null,
            author: data.uploader || null,
            duration: data.duration || null
          };
        }
      }
    } catch (err) {
      // Try next public instance
    }
  }

  // 4. Query public Invidious API instances as secondary fallback
  const invidiousInstances = [
    'https://inv.tux.pizza',
    'https://invidious.nerdvpn.de',
    'https://invidious.privacyredirect.com'
  ];

  for (const invBase of invidiousInstances) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4200);
      const res = await fetch(`${invBase}/api/v1/videos/${videoId}`, {
        signal: controller.signal
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        const formatStreams = Array.isArray(data.formatStreams) ? data.formatStreams : [];
        const best =
          formatStreams.find((s) => (s.container === 'mp4' || s.type?.includes('mp4')) && s.url) ||
          formatStreams[0];
        if (best && best.url) {
          return {
            streamUrl: best.url,
            title: data.title || null,
            author: data.author || null,
            duration: data.lengthSeconds || null
          };
        }
      }
    } catch (err) {
      // Try next instance
    }
  }

  return null;
}

// ============================================================================
// REAL BINARY GIF89a ENCODER (Pure JS Client-Side 256-Color + LZW Compression)
// ============================================================================
function createAnimatedGifBlob(frames, width, height, delayMs) {
  const bytes = [];
  const writeByte = (b) => bytes.push(b & 0xff);
  const writeShort = (s) => {
    bytes.push(s & 0xff);
    bytes.push((s >> 8) & 0xff);
  };
  const writeString = (str) => {
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i));
    }
  };

  // 1. GIF89a Header
  writeString('GIF89a');

  // 2. Logical Screen Descriptor (Global Color Table 256 colors: 3-3-2 RGB Cube)
  writeShort(width);
  writeShort(height);
  writeByte(0xf7);
  writeByte(0);
  writeByte(0);

  // 3. Global Color Table (256 colors using uniform 3-3-2 bit RGB quantization)
  for (let i = 0; i < 256; i++) {
    const r = ((i >> 5) & 0x07) * 36;
    const g = ((i >> 2) & 0x07) * 36;
    const b = (i & 0x03) * 85;
    writeByte(Math.min(255, r));
    writeByte(Math.min(255, g));
    writeByte(Math.min(255, b));
  }

  // 4. Netscape 2.0 Application Extension for Infinite Looping
  writeByte(0x21);
  writeByte(0xff);
  writeByte(11);
  writeString('NETSCAPE2.0');
  writeByte(3);
  writeByte(1);
  writeShort(0);
  writeByte(0);

  const encodeLZW = (indexedPixels) => {
    const minCodeSize = 8;
    const clearCode = 1 << minCodeSize;
    const eoiCode = clearCode + 1;
    let nextCode = eoiCode + 1;
    let codeSize = minCodeSize + 1;

    const subBlockBytes = [];
    let bitBuffer = 0;
    let bitCount = 0;

    const emitCode = (code) => {
      bitBuffer |= code << bitCount;
      bitCount += codeSize;
      while (bitCount >= 8) {
        subBlockBytes.push(bitBuffer & 0xff);
        bitBuffer >>= 8;
        bitCount -= 8;
      }
    };

    let codeTable = new Map();
    emitCode(clearCode);

    if (indexedPixels.length === 0) {
      emitCode(eoiCode);
    } else {
      let prefix = indexedPixels[0];

      for (let i = 1; i < indexedPixels.length; i++) {
        const suffix = indexedPixels[i];
        const key = (prefix << 8) | suffix;

        if (codeTable.has(key)) {
          prefix = codeTable.get(key);
        } else {
          emitCode(prefix);
          if (nextCode < 4096) {
            codeTable.set(key, nextCode);
            if (nextCode === (1 << codeSize) && codeSize < 12) {
              codeSize++;
            }
            nextCode++;
          } else {
            emitCode(clearCode);
            codeTable.clear();
            codeSize = minCodeSize + 1;
            nextCode = eoiCode + 1;
          }
          prefix = suffix;
        }
      }
      emitCode(prefix);
      emitCode(eoiCode);
    }

    if (bitCount > 0) {
      subBlockBytes.push(bitBuffer & 0xff);
    }

    writeByte(minCodeSize);
    let offset = 0;
    while (offset < subBlockBytes.length) {
      const chunkLen = Math.min(255, subBlockBytes.length - offset);
      writeByte(chunkLen);
      for (let j = 0; j < chunkLen; j++) {
        writeByte(subBlockBytes[offset + j]);
      }
      offset += chunkLen;
    }
    writeByte(0);
  };

  const delayHundredths = Math.max(2, Math.round(delayMs / 10));

  for (let f = 0; f < frames.length; f++) {
    const rgba = frames[f];
    const pixelCount = width * height;
    const indexed = new Uint8Array(pixelCount);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const p = idx * 4;
        const dither = (((x & 1) + ((y & 1) << 1)) - 1.5) * 6;
        const r = Math.max(0, Math.min(255, rgba[p] + dither));
        const g = Math.max(0, Math.min(255, rgba[p + 1] + dither));
        const b = Math.max(0, Math.min(255, rgba[p + 2] + dither));

        const r3 = (r >> 5) & 0x07;
        const g3 = (g >> 5) & 0x07;
        const b2 = (b >> 6) & 0x03;
        indexed[idx] = (r3 << 5) | (g3 << 2) | b2;
      }
    }

    writeByte(0x21);
    writeByte(0xf9);
    writeByte(4);
    writeByte(0x04);
    writeShort(delayHundredths);
    writeByte(0);
    writeByte(0);

    writeByte(0x2c);
    writeShort(0);
    writeShort(0);
    writeShort(width);
    writeShort(height);
    writeByte(0);

    encodeLZW(indexed);
  }

  writeByte(0x3b);
  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
}

// ============================================================================
// CONSTANTS & PRESETS
// ============================================================================
const PLATFORM_PRESETS = [
  {
    id: 'discord',
    name: 'Discord Preset',
    limitMB: 8.0,
    fps: 15,
    resHeight: 360,
    icon: '💬',
    tagline: 'Strict < 8 MB auto-fit',
    accent: 'border-indigo-400/70 bg-indigo-500/20 text-indigo-200'
  },
  {
    id: 'twitter',
    name: 'X / Twitter',
    limitMB: 15.0,
    fps: 24,
    resHeight: 480,
    icon: '𝕏',
    tagline: 'Crisp < 15 MB loop',
    accent: 'border-sky-400/70 bg-sky-500/20 text-sky-200'
  },
  {
    id: 'slack',
    name: 'Slack / Chat',
    limitMB: 5.0,
    fps: 12,
    resHeight: 240,
    icon: '⚡',
    tagline: 'Compact < 5 MB reaction',
    accent: 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
  },
  {
    id: 'reddit',
    name: 'Reddit HD',
    limitMB: 50.0,
    fps: 30,
    resHeight: 720,
    icon: '🔥',
    tagline: 'High-definition loop',
    accent: 'border-amber-400/70 bg-amber-500/20 text-amber-200'
  }
];

const SOCIAL_PLATFORMS = [
  { id: 'youtube', name: 'YouTube', match: ['youtube.com', 'youtu.be'] },
  { id: 'tiktok', name: 'TikTok', match: ['tiktok.com'] },
  { id: 'instagram', name: 'Instagram', match: ['instagram.com'] },
  { id: 'twitter', name: 'X / Twitter', match: ['x.com', 'twitter.com'] },
  { id: 'facebook', name: 'Facebook', match: ['facebook.com', 'fb.watch'] },
  { id: 'snapchat', name: 'Snapchat', match: ['snapchat.com'] }
];

const MEME_TEMPLATES = [
  { label: 'Wait For It...', top: 'WAIT FOR IT...', bottom: 'ABSOLUTELY LEGENDARY' },
  { label: 'Monday POV', top: 'POV: IT IS 8:01 AM', bottom: 'ON A MONDAY MORNING' },
  { label: 'Friday 4:59PM', top: 'CLOSING MY LAPTOP', bottom: 'AT 4:59:59 PM ON FRIDAY' },
  { label: 'No Way', top: 'AIN\'T NO WAY', bottom: 'THIS ACTUALLY HAPPENED' }
];

const REACTION_STAMPS = [
  { id: 'none', label: 'None', emoji: '🚫' },
  { id: 'fire', label: 'Fire', emoji: '🔥' },
  { id: 'laugh', label: 'Laugh', emoji: '😂' },
  { id: 'skull', label: 'Skull', emoji: '💀' },
  { id: 'sparkles', label: 'Magic', emoji: '✨' },
  { id: 'shock', label: 'Shock', emoji: '🤯' }
];

// ============================================================================
// PROCEDURAL STREAM RENDERER (Used when a social URL or sample stream is loaded)
// ============================================================================
function drawStreamCanvasScene(ctx, width, height, streamStyle, t) {
  ctx.save();

  if (streamStyle === 'tiktok' || streamStyle === 'snapchat') {
    // Neon Dancefloor / Vibing Cat Stream
    ctx.fillStyle = '#180526';
    ctx.fillRect(0, 0, width, height);

    const cols = 6;
    const rows = 3;
    const floorTop = height * 0.62;
    const cellW = width / cols;
    const cellH = (height - floorTop) / rows;
    const discoPalette = ['#f43f5e', '#a855f7', '#06b6d4', '#eab308', '#10b981'];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const colorIdx = Math.floor(t * 6 + r * 3 + c * 2) % discoPalette.length;
        ctx.fillStyle = discoPalette[colorIdx];
        ctx.globalAlpha = 0.65;
        ctx.fillRect(c * cellW + 2, floorTop + r * cellH + 2, cellW - 4, cellH - 4);
      }
    }
    ctx.globalAlpha = 1;

    for (let b = 0; b < 3; b++) {
      const angle = Math.sin(t * 2.5 + b * 2) * 0.45;
      ctx.save();
      ctx.translate(width * (0.25 + b * 0.25), 0);
      ctx.rotate(angle);
      const beamGrad = ctx.createLinearGradient(0, 0, 0, height);
      beamGrad.addColorStop(0, 'rgba(232, 121, 249, 0.45)');
      beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(20, 0);
      ctx.lineTo(90, height);
      ctx.lineTo(-90, height);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const bobY = Math.sin(t * 9) * 14;
    const bobX = Math.cos(t * 4.5) * 12;
    const cx = width * 0.5 + bobX;
    const cy = height * 0.54 + bobY;
    const r = Math.min(width, height) * 0.19;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(-r * 0.85, -r * 0.2);
    ctx.lineTo(-r * 0.95, -r * 1.15);
    ctx.lineTo(-r * 0.2, -r * 0.75);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.85, -r * 0.2);
    ctx.lineTo(r * 0.95, -r * 1.15);
    ctx.lineTo(r * 0.2, -r * 0.75);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#090d16';
    ctx.fillRect(-r * 0.85, -r * 0.25, r * 0.75, r * 0.42);
    ctx.fillRect(r * 0.1, -r * 0.25, r * 0.75, r * 0.42);
    ctx.fillRect(-r * 0.95, -r * 0.18, r * 1.9, r * 0.12);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-r * 0.7, -r * 0.18, r * 0.18, r * 0.25);
    ctx.fillRect(r * 0.25, -r * 0.18, r * 0.18, r * 0.25);
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(0, r * 0.28, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (streamStyle === 'instagram' || streamStyle === 'facebook') {
    // Dramatic Zoom Squirrel Stream
    const zoomCycle = (t % 2.0) / 2.0;
    const zoomScale = 1 + Math.pow(zoomCycle, 2) * 0.85;

    ctx.fillStyle = '#451a03';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    ctx.strokeStyle = '#fde047';
    for (let i = 0; i < 36; i++) {
      const ang = (i / 36) * Math.PI * 2 + t * 3;
      const innerR = Math.min(width, height) * (0.22 + (i % 3) * 0.05);
      ctx.lineWidth = (i % 2) + 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * innerR, cy + Math.sin(ang) * innerR);
      ctx.lineTo(cx + Math.cos(ang) * width, cy + Math.sin(ang) * width);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(zoomScale, zoomScale);
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(-36, -42, 16, 0, Math.PI * 2);
    ctx.arc(36, -42, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-20, -8, 16, 0, Math.PI * 2);
    ctx.arc(20, -8, 16, 0, Math.PI * 2);
    ctx.fill();
    const jitterX = Math.sin(t * 45) * 2;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(-20 + jitterX, -8, 6, 0, Math.PI * 2);
    ctx.arc(20 + jitterX, -8, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.ellipse(0, 24, 12, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-7, 10, 6, 9);
    ctx.fillRect(1, 10, 6, 9);
    ctx.restore();
  } else {
    // Cozy Action Conveyor Stream (With Distinct Time-Stamped Scene Phases so Trimming is Visually Obvious)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#142f24');
    bgGrad.addColorStop(0.7, '#1f3d2d');
    bgGrad.addColorStop(1, '#2d1c10');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 4; i++) {
      const lx = width * (0.18 + i * 0.22);
      const swing = Math.sin(t * 3 + i) * 10;
      const ly = height * 0.16;

      ctx.strokeStyle = '#78502b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx + swing, ly);
      ctx.stroke();

      const glow = ctx.createRadialGradient(lx + swing, ly, 2, lx + swing, ly, 36);
      glow.addColorStop(0, 'rgba(253, 224, 71, 0.9)');
      glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(lx + swing, ly, 36, 0, Math.PI * 2);
      ctx.fill();
    }

    const beltY = height * 0.76;
    ctx.fillStyle = '#27272a';
    ctx.fillRect(0, beltY, width, height * 0.12);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, beltY, width, height * 0.12);

    // Animated GIF crates rolling along the conveyor belt with timestamp numbers
    const numBoxes = 4;
    for (let i = 0; i < numBoxes; i++) {
      const bx = (((t * 110) + i * (width / numBoxes)) % (width + 80)) - 40;
      const by = beltY - 46;
      ctx.fillStyle = i % 2 === 0 ? '#10b981' : '#f59e0b';
      ctx.fillRect(bx, by, 52, 44);
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, 52, 44);
      ctx.fillStyle = '#064e3b';
      ctx.font = '900 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`GIF #${i + 1}`, bx + 26, by + 26);
    }

    // Center Workshop Clockwork Progress Dial so users immediately see the exact timestamp frame when trimming
    const cx = width * 0.5;
    const cy = height * 0.43;
    const radius = Math.min(width, height) * 0.16;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(6, 78, 59, 0.85)';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rotating hand tied directly to timestamp `t`
    const handAngle = (t / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(handAngle) * (radius * 0.75), Math.sin(handAngle) * (radius * 0.75));
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.font = `900 ${Math.max(12, Math.round(radius * 0.42))}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${t.toFixed(1)}s`, 0, radius * 0.45);
    ctx.restore();
  }

  ctx.restore();
}

// Render composite frame (Real HTML5 Video Frame or Procedural Stream + Filters + Stamp + Meme Text)
function renderCompositeFrame({
  ctx,
  canvasWidth,
  canvasHeight,
  sourceType,
  videoEl,
  ytImages,
  ytMetadata,
  streamStyle,
  timestamp,
  videoDuration = 15,
  trimStart = 0,
  trimEnd = 6,
  filters,
  memeConfig,
  selectedStamp
}) {
  ctx.save();
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const brightness = filters.deepFry ? 135 : 100;
  const contrast = filters.deepFry ? 240 : filters.contrast;
  const saturate = filters.deepFry ? 320 : filters.saturation;
  const sepia = filters.sepia ? 85 : 0;
  const hueRotate = filters.nightVision ? 90 : 0;

  ctx.filter = `contrast(${contrast}%) saturate(${saturate}%) brightness(${brightness}%) sepia(${sepia}%) hue-rotate(${hueRotate}deg)`;

  if (sourceType === 'video' && videoEl && videoEl.readyState >= 2) {
    // Draw the exact real video frame from the HTML5 <video> element (NO Ken Burns pan/zoom!)
    const vw = videoEl.videoWidth || 640;
    const vh = videoEl.videoHeight || 360;
    const scale = Math.max(canvasWidth / vw, canvasHeight / vh);
    const sw = vw * scale;
    const sh = vh * scale;
    const dx = (canvasWidth - sw) / 2;
    const dy = (canvasHeight - sh) / 2;
    ctx.drawImage(videoEl, dx, dy, sw, sh);
  } else if (sourceType === 'youtube' && ytImages && ytImages.length > 0) {
    // Clean static storyboard frame lookup without any fake Ken Burns pan/zoom oscillation
    const totalDur = Math.max(1, videoDuration);
    const absProgress = Math.max(0, Math.min(0.9999, timestamp / totalDur));
    const imgIndex = Math.min(
      ytImages.length - 1,
      Math.floor(absProgress * ytImages.length)
    );
    const activeImg = ytImages[imgIndex] || ytImages[0];

    if (activeImg && activeImg.complete && activeImg.naturalWidth > 0) {
      const iw = activeImg.naturalWidth;
      const ih = activeImg.naturalHeight;
      const scale = Math.max(canvasWidth / iw, canvasHeight / ih);
      const sw = iw * scale;
      const sh = ih * scale;
      const dx = (canvasWidth - sw) / 2;
      const dy = (canvasHeight - sh) / 2;
      ctx.drawImage(activeImg, dx, dy, sw, sh);
    } else {
      drawStreamCanvasScene(ctx, canvasWidth, canvasHeight, 'workshop', timestamp);
    }
  } else {
    drawStreamCanvasScene(ctx, canvasWidth, canvasHeight, streamStyle, timestamp);
  }

  ctx.filter = 'none';

  if (filters.nightVision) {
    ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // Optional Reaction Sticker Stamp
  if (selectedStamp && selectedStamp !== 'none') {
    const stampObj = REACTION_STAMPS.find((s) => s.id === selectedStamp);
    if (stampObj) {
      const bounceScale = 1 + Math.sin(timestamp * 8) * 0.08;
      ctx.save();
      ctx.translate(canvasWidth * 0.86, canvasHeight * 0.5);
      ctx.scale(bounceScale, bounceScale);
      ctx.rotate(0.12);
      const emojiSize = Math.max(28, Math.round(canvasHeight * 0.14));
      ctx.font = `${emojiSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(stampObj.emoji, 0, 0);
      ctx.restore();
    }
  }

  // Classic Impact Meme Text Overlay
  const drawMemeLine = (text, yRatio) => {
    if (!text || !text.trim()) return;
    const clean = memeConfig.allCaps ? text.toUpperCase() : text;
    const scaledFontSize = Math.max(14, Math.round((memeConfig.fontSize / 480) * canvasHeight));

    ctx.font = `900 ${scaledFontSize}px Impact, "Arial Black", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    const words = clean.split(' ');
    const lines = [];
    let currentLine = words[0] || '';
    const maxLineWidth = canvasWidth * 0.92;

    for (let i = 1; i < words.length; i++) {
      const testLine = currentLine + ' ' + words[i];
      if (ctx.measureText(testLine).width < maxLineWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);

    const lineHeight = scaledFontSize * 1.12;
    const totalHeight = lines.length * lineHeight;
    const startY = canvasHeight * yRatio - totalHeight / 2 + lineHeight / 2;

    lines.forEach((line, idx) => {
      const ly = startY + idx * lineHeight;
      if (memeConfig.strokeWidth > 0) {
        ctx.lineWidth = Math.max(2, (memeConfig.strokeWidth / 480) * canvasHeight * 2.2);
        ctx.strokeStyle = '#000000';
        ctx.strokeText(line, canvasWidth / 2, ly);
      }
      ctx.fillStyle = memeConfig.textColor;
      ctx.fillText(line, canvasWidth / 2, ly);
    });
  };

  drawMemeLine(memeConfig.topText, memeConfig.topY);
  drawMemeLine(memeConfig.bottomText, memeConfig.bottomY);

  ctx.restore();
}

// ============================================================================
// UNNAMED CARTOON ELF ILLUSTRATIONS & ANIMATIONS FOR LAYOUT SECTIONS
// ============================================================================

// 1. Animated GIF Elf Logo Illustration (Header Brand Mark)
function AnimatedLogoElf() {
  return (
    <div className="relative w-12 h-12 shrink-0 flex items-center justify-center select-none group">
      <svg viewBox="0 0 80 80" className="w-12 h-12 overflow-visible">
        {/* Magical glowing aura */}
        <circle cx="40" cy="42" r="32" fill="url(#elfGlow)" className=" opacity-80" />
        <defs>
          <radialGradient id="elfGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Spinning Film Reel behind Elf */}
        <g
          style={{
            transformOrigin: '56px 52px',
            animation: 'spin 6s linear infinite'
          }}
        >
          <circle cx="56" cy="52" r="16" fill="#064e3b" stroke="#fbbf24" strokeWidth="2.5" />
          <circle cx="56" cy="52" r="4" fill="#fde047" />
          <circle cx="56" cy="42" r="2.5" fill="#fef08a" />
          <circle cx="56" cy="62" r="2.5" fill="#fef08a" />
          <circle cx="46" cy="52" r="2.5" fill="#fef08a" />
          <circle cx="66" cy="52" r="2.5" fill="#fef08a" />
        </g>

        {/* Wiggling Pointy Elf Ears */}
        <polygon
          points="8,40 22,35 20,47"
          fill="#fcd34d"
          stroke="#d97706"
          strokeWidth="1.5"
          className="origin-right group-hover:-rotate-12 transition-transform"
        />
        <polygon
          points="60,38 46,35 48,47"
          fill="#fcd34d"
          stroke="#d97706"
          strokeWidth="1.5"
          className="origin-left group-hover:rotate-12 transition-transform"
        />

        {/* Cartoon Elf Head */}
        <circle cx="34" cy="42" r="15" fill="#fde68a" stroke="#b45309" strokeWidth="1.5" />

        {/* Rosy Cheeks & Big Joyful Smile */}
        <circle cx="25" cy="44" r="2.8" fill="#fb7185" opacity="0.65" />
        <circle cx="43" cy="44" r="2.8" fill="#fb7185" opacity="0.65" />
        <circle cx="29" cy="39" r="2.3" fill="#064e3b" />
        <circle cx="39" cy="39" r="2.3" fill="#064e3b" />
        <circle cx="29.8" cy="38.2" r="0.8" fill="#ffffff" />
        <circle cx="39.8" cy="38.2" r="0.8" fill="#ffffff" />
        <path
          d="M28 45 Q34 51 40 45"
          stroke="#064e3b"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Bouncing Pointy Green Workshop Hat with Golden Bell */}
        <g className="animate-bounce" style={{ animationDuration: '2.6s' }}>
          <path
            d="M17 31 Q34 26 51 31 L38 7 Q30 4 24 14 Z"
            fill="#10b981"
            stroke="#047857"
            strokeWidth="1.5"
          />
          {/* Hat brim */}
          <path
            d="M15 31 Q34 26 52 31"
            stroke="#fef08a"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
          {/* Jingle Bell Tip */}
          <circle cx="37" cy="7" r="4.5" fill="#facc15" stroke="#ca8a04" strokeWidth="1.2" />
        </g>

        {/* Mini "GIF" Badge Held in Front */}
        <rect
          x="14"
          y="55"
          width="32"
          height="15"
          rx="4"
          fill="#f59e0b"
          stroke="#fef08a"
          strokeWidth="1.5"
        />
        <text
          x="30"
          y="65.5"
          textAnchor="middle"
          fill="#064e3b"
          fontSize="9.5"
          fontWeight="900"
          fontFamily="sans-serif"
        >
          .GIF
        </text>
      </svg>
    </div>
  );
}

// 2. Cartoon Elf Peering with Magnifying Glass & Film Strip (Source Input Section)
function LinkScoutElfIllustration({ isBusy }) {
  return (
    <svg viewBox="0 0 110 70" className="w-20 h-14 shrink-0 overflow-visible select-none">
      {/* Unspooling Film Strip Wave */}
      <path
        d="M8 56 Q32 40 56 54 T102 48"
        stroke="#fbbf24"
        strokeWidth="6"
        strokeDasharray="4 2"
        fill="none"
        opacity="0.7"
      />
      {/* Elf Ears */}
      <polygon points="24,34 35,30 34,40" fill="#fde68a" />
      <polygon points="74,34 63,30 64,40" fill="#fde68a" />
      {/* Elf Head */}
      <circle cx="49" cy="36" r="14" fill="#fde68a" stroke="#b45309" strokeWidth="1.2" />
      {/* Pointy Hat */}
      <path d="M33 27 L65 27 L52 6 Z" fill="#10b981" />
      <circle cx="52" cy="6" r="3.5" fill="#fef08a" />
      {/* Eyes */}
      <circle cx="44" cy="35" r="2" fill="#064e3b" />
      <circle cx="54" cy="35" r="2" fill="#064e3b" />
      <path d="M45 41 Q49 44 53 41" stroke="#064e3b" strokeWidth="1.8" fill="none" />
      {/* Animated Magnifying Glass */}
      <g
        className={isBusy ? 'animate-bounce' : ''}
        style={{ transformOrigin: '72px 38px' }}
      >
        <circle
          cx="70"
          cy="34"
          r="9"
          fill="rgba(56, 189, 248, 0.25)"
          stroke="#facc15"
          strokeWidth="2.8"
        />
        <line x1="76" y1="40" x2="85" y2="49" stroke="#b45309" strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// 3. Cartoon Elf Cranking a Brass Gear (Timeline / Speed Controls Section)
function GearCrankElfIllustration({ speed = 1, isReverse = false }) {
  const spinDuration = Math.max(0.4, 2.4 / speed);
  return (
    <svg viewBox="0 0 110 70" className="w-20 h-14 shrink-0 overflow-visible select-none">
      {/* Spinning Brass Clockwork Gear */}
      <g
        style={{
          transformOrigin: '74px 38px',
          animation: `spin ${spinDuration}s linear infinite`,
          animationDirection: isReverse ? 'reverse' : 'normal'
        }}
      >
        <circle cx="74" cy="38" r="15" fill="#f59e0b" stroke="#fef08a" strokeWidth="2" />
        <circle cx="74" cy="38" r="5" fill="#064e3b" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <rect
            key={deg}
            x="71.5"
            y="18"
            width="5"
            height="6"
            rx="1.5"
            fill="#fbbf24"
            transform={`rotate(${deg} 74 38)`}
          />
        ))}
      </g>

      {/* Little Elf Leaning & Turning the Crank */}
      <polygon points="16,35 26,32 25,40" fill="#fde68a" />
      <circle cx="36" cy="36" r="12" fill="#fde68a" stroke="#b45309" strokeWidth="1.2" />
      <path d="M22 28 L50 28 L34 9 Z" fill="#f59e0b" />
      <circle cx="34" cy="9" r="3.5" fill="#ffffff" />
      <circle cx="33" cy="35" r="1.8" fill="#064e3b" />
      <circle cx="41" cy="35" r="1.8" fill="#064e3b" />
      <path d="M33 40 Q37 43 41 40" stroke="#064e3b" strokeWidth="1.6" fill="none" />
      {/* Elf Arm reaching to gear handle */}
      <path d="M44 44 L66 38" stroke="#10b981" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="66" cy="38" r="3" fill="#fde68a" />
    </svg>
  );
}

// 4. Cartoon Elf Holding a Giant Paintbrush (Meme Text Overlay Section)
function PainterElfIllustration({ isPainting }) {
  return (
    <svg viewBox="0 0 110 70" className="w-20 h-14 shrink-0 overflow-visible select-none">
      {/* Elf Ears & Head */}
      <polygon points="16,36 27,32 26,41" fill="#fde68a" />
      <polygon points="62,36 51,32 52,41" fill="#fde68a" />
      <circle cx="39" cy="37" r="13" fill="#fde68a" stroke="#b45309" strokeWidth="1.2" />
      {/* Painter Beret / Pointy Hat */}
      <path d="M24 28 L55 28 L37 8 Z" fill="#ec4899" />
      <circle cx="37" cy="8" r="3.5" fill="#fef08a" />
      <circle cx="35" cy="36" r="1.8" fill="#064e3b" />
      <circle cx="43" cy="36" r="1.8" fill="#064e3b" />
      <path d="M35 42 Q39 45 43 42" stroke="#064e3b" strokeWidth="1.8" fill="none" />

      {/* Giant Animated Paintbrush */}
      <g
        className={isPainting ? 'animate-bounce' : ''}
        style={{ transformOrigin: '65px 38px' }}
      >
        <rect
          x="48"
          y="36"
          width="28"
          height="5"
          rx="2.5"
          fill="#92400e"
          transform="rotate(-18 48 36)"
        />
        <polygon
          points="74,24 88,22 78,34"
          fill="#38bdf8"
          stroke="#bae6fd"
          strokeWidth="1"
        />
        <circle cx="88" cy="19" r="2.5" fill="#f43f5e" className="animate-ping" />
      </g>
    </svg>
  );
}

// 5. Two Little Elves Operating a Compression Press (Export Section)
function PressElvesIllustration({ isUnderLimit }) {
  return (
    <svg viewBox="0 0 120 70" className="w-24 h-14 shrink-0 overflow-visible select-none">
      {/* Left Elf */}
      <circle cx="24" cy="40" r="10" fill="#fde68a" />
      <path d="M13 33 L35 33 L22 16 Z" fill="#10b981" />
      <circle cx="22" cy="16" r="2.5" fill="#fef08a" />
      <circle cx="21" cy="39" r="1.5" fill="#064e3b" />
      <circle cx="27" cy="39" r="1.5" fill="#064e3b" />

      {/* Center Compression Clamp / GIF Box */}
      <rect
        x="45"
        y="26"
        width="30"
        height="26"
        rx="5"
        fill={isUnderLimit ? '#10b981' : '#f43f5e'}
        stroke="#fef08a"
        strokeWidth="2"
      />
      <text
        x="60"
        y="43"
        textAnchor="middle"
        fill="#064e3b"
        fontSize="9"
        fontWeight="900"
      >
        MB
      </text>
      {/* Top press plate */}
      <rect x="42" y="18" width="36" height="5" rx="2" fill="#fbbf24" />

      {/* Right Elf */}
      <circle cx="96" cy="40" r="10" fill="#fde68a" />
      <path d="M85 33 L107 33 L98 16 Z" fill="#6366f1" />
      <circle cx="98" cy="16" r="2.5" fill="#fef08a" />
      <circle cx="93" cy="39" r="1.5" fill="#064e3b" />
      <circle cx="99" cy="39" r="1.5" fill="#064e3b" />
    </svg>
  );
}

// ============================================================================
// REAL GOOGLE ADSENSE HORIZONTAL LEADERBOARD UNIT (ca-pub-7168491151155439)
// ============================================================================
function AdSenseLeaderboard({ positionLabel }) {
  const adRef = useRef(null);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && adRef.current) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (err) {
      // AdSense script may still be initializing or blocked by browser adblocker
    }
  }, []);

  return (
    <div className="w-full max-w-3xl mx-auto my-3">
      <div className="text-[10px] uppercase tracking-widest text-emerald-400/50 text-center mb-1 font-semibold">
        Advertisement
      </div>
      <div className="w-full min-h-[90px] rounded-xl bg-[#08150f]/90 border border-emerald-800/70 flex items-center justify-center overflow-hidden px-2 py-1 shadow-inner">
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', minHeight: '90px' }}
          data-ad-client="ca-pub-7168491151155439"
          data-ad-format="horizontal"
          data-full-width-responsive="true"
          aria-label={positionLabel}
        />
      </div>
    </div>
  );
}

// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================
export default function App() {
  // Inject real Google Analytics (G-4VVHB2DJJ2) & Google AdSense (ca-pub-7168491151155439) scripts
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // 1. Google AdSense Script
    if (!document.querySelector('script[src*="ca-pub-7168491151155439"]')) {
      const adsScript = document.createElement('script');
      adsScript.async = true;
      adsScript.src =
        'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7168491151155439';
      adsScript.crossOrigin = 'anonymous';
      document.head.appendChild(adsScript);
    }

    // 2. Google Analytics gtag.js (G-4VVHB2DJJ2)
    if (!document.querySelector('script[src*="G-4VVHB2DJJ2"]')) {
      const gaScript = document.createElement('script');
      gaScript.async = true;
      gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-4VVHB2DJJ2';
      document.head.appendChild(gaScript);

      window.dataLayer = window.dataLayer || [];
      function gtag() {
        window.dataLayer.push(arguments);
      }
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', 'G-4VVHB2DJJ2');
    }
  }, []);

  // Video / Stream Source State (Defaults: Blank URL input, Normal Loop, 0.0s Loop Start, Blank Meme Overlays)
  const [hasLoadedMedia, setHasLoadedMedia] = useState(true);
  const [sourceType, setSourceType] = useState('stream'); // 'video' | 'youtube' | 'stream'
  const [youtubeVideoId, setYoutubeVideoId] = useState('');
  const [youtubeAuthor, setYoutubeAuthor] = useState('');
  const [ytImagesLoaded, setYtImagesLoaded] = useState([]);

  const [streamStyle, setStreamStyle] = useState('workshop'); // 'workshop' | 'tiktok' | 'instagram'
  const [mediaTitle, setMediaTitle] = useState('Workshop Preview Stream');
  const [videoDuration, setVideoDuration] = useState(10.0);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Social Link Importer State (Blank by default)
  const [socialUrl, setSocialUrl] = useState('');
  const [socialExtractState, setSocialExtractState] = useState(null); // null | 'extracting' | 'resolved' | 'storyboard_fallback' | 'error'
  const [detectedPlatform, setDetectedPlatform] = useState(null);
  const [streamNotice, setStreamNotice] = useState('');
  const [showGifLightbox, setShowGifLightbox] = useState(false);

  // Trim & Loop Controls (Loop Start defaults to 0, Loop Mode defaults to 'normal')
  const [trimStart, setTrimStart] = useState(0.0);
  const [trimEnd, setTrimEnd] = useState(4.5);
  const [loopMode, setLoopMode] = useState('normal'); // 'normal' | 'reverse' | 'pingpong'
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // 0.5, 1, 1.5, 2
  const [isPlaying, setIsPlaying] = useState(true);
  const [displayPlayhead, setDisplayPlayhead] = useState(0.0);

  // Meme & Visual Studio Controls (Top & Bottom Text default to blank)
  const [isTypingMeme, setIsTypingMeme] = useState(false);
  const [selectedStamp, setSelectedStamp] = useState('none');
  const [memeConfig, setMemeConfig] = useState({
    topText: '',
    bottomText: '',
    fontSize: 38,
    textColor: '#ffffff',
    strokeWidth: 4,
    allCaps: true,
    topY: 0.12,
    bottomY: 0.88
  });

  const [aspectRatio, setAspectRatio] = useState('16:9'); // '16:9' | '1:1' | '9:16' | '4:3'
  const [filters, setFilters] = useState({
    contrast: 105,
    saturation: 115,
    sepia: false,
    deepFry: false,
    nightVision: false
  });

  // Export & Compression Controls
  const [selectedPlatformId, setSelectedPlatformId] = useState('discord');
  const [exportFps, setExportFps] = useState(15);
  const [exportResHeight, setExportResHeight] = useState(360);
  const [isEncoding, setIsEncoding] = useState(false);
  const [encodeProgress, setEncodeProgress] = useState(0);
  const [exportedGifUrl, setExportedGifUrl] = useState(null);
  const [exportedGifSizeMB, setExportedGifSizeMB] = useState('0.00');

  // High-performance Refs for 60fps Smooth Canvas Rendering (Avoids 60fps React state re-renders!)
  const canvasRef = useRef(null);
  const hiddenVideoRef = useRef(null);
  const playheadRef = useRef(0.0);
  const lastFrameTimeRef = useRef(performance.now());
  const lastUiSyncRef = useRef(0);
  const playDirectionRef = useRef(1);
  const typingTimeoutRef = useRef(null);

  // Load CORS-friendly YouTube storyboard frames (hq1, hq2, hq3, hqdefault) for Canvas Preview & GIF Encoding
  const loadYouTubeStoryboardFrames = useCallback((videoId) => {
    if (!videoId) return;
    setYtImagesLoaded([]);
    const urls = [
      `https://i.ytimg.com/vi/${videoId}/hq1.jpg`,
      `https://i.ytimg.com/vi/${videoId}/hq2.jpg`,
      `https://i.ytimg.com/vi/${videoId}/hq3.jpg`,
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    ];
    const loadedMap = {};

    urls.forEach((src, idx) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (img.naturalWidth > 140 || idx === 3) {
          loadedMap[idx] = img;
        }
        const ordered = Object.keys(loadedMap)
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => loadedMap[k]);
        if (ordered.length > 0) {
          setYtImagesLoaded(ordered);
        }
      };
      img.src = src;
    });
  }, []);

  // Fetch real YouTube Title & Author via noembed CORS-friendly oEmbed endpoint
  const fetchYouTubeOEmbedMetadata = useCallback(async (videoId) => {
    const known = KNOWN_YOUTUBE_METADATA[videoId];
    if (known) {
      setMediaTitle(known.title);
      setYoutubeAuthor(known.author);
      setVideoDuration(known.duration);
    } else {
      setMediaTitle(`YouTube Video (${videoId})`);
      setYoutubeAuthor('YouTube Creator');
    }

    try {
      const res = await fetch(
        `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.title) setMediaTitle(data.title);
        if (data.author_name) setYoutubeAuthor(data.author_name);
      }
    } catch (e) {
      // Fallback to known metadata or ID
    }
  }, []);

  // Helper to immediately seek preview to an exact timestamp (used when dragging Loop Start / Loop End)
  const seekPreviewToTimestamp = useCallback((targetSec) => {
    playheadRef.current = targetSec;
    setDisplayPlayhead(targetSec);
    const video = hiddenVideoRef.current;
    if (video && video.readyState >= 1) {
      video.currentTime = targetSec;
    }
  }, []);

  // Trigger paintbrush animation when editing meme text
  const triggerPaintbrushAnimation = () => {
    setIsTypingMeme(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTypingMeme(false), 900);
  };

  // Detect social platform from URL input
  const detectPlatformFromUrl = (urlStr) => {
    const lower = (urlStr || '').toLowerCase();
    return (
      SOCIAL_PLATFORMS.find((p) => p.match.some((domain) => lower.includes(domain))) || null
    );
  };

  // Compute target dimensions based on Aspect Ratio & Resolution Height
  const targetDimensions = useMemo(() => {
    const h = exportResHeight;
    let w = Math.round((h * 16) / 9);
    if (aspectRatio === '1:1') w = h;
    if (aspectRatio === '9:16') w = Math.round((h * 9) / 16);
    if (aspectRatio === '4:3') w = Math.round((h * 4) / 3);
    return {
      width: w % 2 === 0 ? w : w + 1,
      height: h % 2 === 0 ? h : h + 1
    };
  }, [aspectRatio, exportResHeight]);

  // Estimate GIF File Size in Real Time
  const sizeEstimate = useMemo(() => {
    const rawClipDuration = Math.max(0.4, trimEnd - trimStart);
    const effectiveDuration =
      (rawClipDuration / playbackSpeed) * (loopMode === 'pingpong' ? 1.9 : 1.0);
    const totalFrames = Math.max(2, Math.round(effectiveDuration * exportFps));
    const pixelsPerFrame = targetDimensions.width * targetDimensions.height;
    const complexityFactor = filters.deepFry ? 0.52 : 0.34;
    const estimatedBytes = totalFrames * pixelsPerFrame * complexityFactor;
    const estimatedMB = estimatedBytes / (1024 * 1024);

    const activePreset =
      PLATFORM_PRESETS.find((p) => p.id === selectedPlatformId) || PLATFORM_PRESETS[0];

    return {
      effectiveDuration: effectiveDuration.toFixed(1),
      totalFrames,
      estimatedMB: Math.max(0.08, estimatedMB),
      limitMB: activePreset.limitMB,
      isUnderLimit: estimatedMB <= activePreset.limitMB
    };
  }, [
    trimStart,
    trimEnd,
    playbackSpeed,
    loopMode,
    exportFps,
    targetDimensions,
    filters.deepFry,
    selectedPlatformId
  ]);

  // Handle local video file upload (File picker or Drag-and-Drop)
  const processUploadedVideoFile = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setMediaTitle(file.name);
    setYoutubeAuthor('Local Video File');
    setSourceType('video');
    setHasLoadedMedia(true);
    setSocialExtractState('resolved');
    setStreamNotice('Loaded real video frames directly from your file.');

    if (hiddenVideoRef.current) {
      hiddenVideoRef.current.src = url;
      hiddenVideoRef.current.load();
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) processUploadedVideoFile(file);
  };

  const handleDropVideo = (e) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processUploadedVideoFile(file);
  };

  // Load a resolved MP4 stream URL into the real HTML5 <video> element
  const loadResolvedMp4IntoVideo = useCallback(
    (streamUrl, fallbackTitle, fallbackAuthor, fallbackDur, ytIdForFallback) => {
      return new Promise((resolve) => {
        const video = hiddenVideoRef.current;
        if (!video) {
          resolve(false);
          return;
        }

        let settled = false;
        const finish = (success) => {
          if (settled) return;
          settled = true;
          video.removeEventListener('loadeddata', onLoaded);
          video.removeEventListener('error', onError);
          resolve(success);
        };

        const onLoaded = () => {
          const dur = video.duration && isFinite(video.duration) ? video.duration : fallbackDur || 15;
          setVideoDuration(dur);
          setTrimStart(0.0);
          setTrimEnd(Math.min(dur, 5.0));
          setSourceType('video');
          seekPreviewToTimestamp(0.0);
          setIsPlaying(true);
          setHasLoadedMedia(true);
          finish(true);
        };

        const onError = () => {
          finish(false);
        };

        video.addEventListener('loadeddata', onLoaded);
        video.addEventListener('error', onError);
        video.crossOrigin = 'anonymous';
        video.src = streamUrl;
        video.load();

        setTimeout(() => finish(false), 5500);
      });
    },
    [seekPreviewToTimestamp]
  );

  // Handle Social Video Link Import (Attempts Real MP4 Video Stream first!)
  const handleExtractSocialUrl = async (overrideUrl) => {
    const targetUrl = overrideUrl !== undefined ? overrideUrl : socialUrl;
    if (!targetUrl.trim()) return;

    setSocialUrl(targetUrl);
    const plat = detectPlatformFromUrl(targetUrl);
    setDetectedPlatform(plat);
    setSocialExtractState('extracting');
    setStreamNotice('Fetching real MP4 video stream...');

    const ytId = parseYouTubeVideoId(targetUrl);

    if (ytId) {
      setYoutubeVideoId(ytId);
      await fetchYouTubeOEmbedMetadata(ytId);
    }

    // 1. Try resolving a real CORS-enabled MP4 stream (Cloudflare /api/stream or Piped/Invidious)
    const resolved = await resolveRealYouTubeMp4Stream(ytId, targetUrl);
    if (resolved && resolved.streamUrl) {
      if (resolved.title) setMediaTitle(resolved.title);
      if (resolved.author) setYoutubeAuthor(resolved.author);

      const loadedOk = await loadResolvedMp4IntoVideo(
        resolved.streamUrl,
        resolved.title,
        resolved.author,
        resolved.duration,
        ytId
      );

      if (loadedOk) {
        setSocialExtractState('resolved');
        setStreamNotice('Real MP4 video stream loaded! Scrubbing & GIF export use exact video frames.');
        return;
      }
    }

    // 2. If YouTube's servers blocked direct cross-origin MP4 streaming in this browser sandbox
    if (ytId) {
      loadYouTubeStoryboardFrames(ytId);
      const known = KNOWN_YOUTUBE_METADATA[ytId];
      const dur = known ? known.duration : 30.0;
      setSourceType('youtube');
      setVideoDuration(dur);
      setTrimStart(0.0);
      setTrimEnd(Math.min(dur, 5.0));
      seekPreviewToTimestamp(0.0);
      setIsPlaying(true);
      setHasLoadedMedia(true);
      setSocialExtractState('storyboard_fallback');
      setStreamNotice(
        'YouTube blocked direct browser MP4 access (CORS) for this clip—showing 4 storyboard snapshots. Upload an MP4 file or connect your Cloudflare Stream Worker for full 60fps video frames.'
      );
      return;
    }

    // 3. Other social URLs without a backend MP4 proxy configured yet
    setSocialExtractState('storyboard_fallback');
    setStreamNotice(
      'Direct social links require a Cloudflare MP4 Stream Worker or uploading the MP4 file directly.'
    );
  };

  // Apply Platform Optimization Preset
  const handleSelectPlatformPreset = (preset) => {
    setSelectedPlatformId(preset.id);
    setExportFps(preset.fps);
    setExportResHeight(preset.resHeight);
  };

  // Auto-Shrink to Fit Target Limit
  const handleAutoShrink = () => {
    if (exportResHeight > 360) {
      setExportResHeight(360);
    } else if (exportFps > 12) {
      setExportFps(12);
    } else {
      setExportResHeight(240);
      setExportFps(10);
    }
  };

  // Keep native HTML5 video play/pause & speed synchronized for butter-smooth forward playback
  useEffect(() => {
    const video = hiddenVideoRef.current;
    if (!video || sourceType !== 'video') return;
    video.playbackRate = playbackSpeed;

    const shouldPlayNative =
      isPlaying &&
      !isEncoding &&
      (loopMode === 'normal' || (loopMode === 'pingpong' && playDirectionRef.current === 1));

    if (shouldPlayNative) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [sourceType, isPlaying, isEncoding, playbackSpeed, loopMode]);

  // 60FPS Smooth Direct Canvas Render Loop (No per-frame React state re-render lag!)
  useEffect(() => {
    let animId;

    const tick = (now) => {
      const dt = Math.min(0.06, (now - lastFrameTimeRef.current) / 1000);
      lastFrameTimeRef.current = now;

      const video = hiddenVideoRef.current;

      if (hasLoadedMedia && isPlaying && !isEncoding) {
        if (
          sourceType === 'video' &&
          video &&
          video.readyState >= 2 &&
          (loopMode === 'normal' || (loopMode === 'pingpong' && playDirectionRef.current === 1))
        ) {
          // Use the browser's hardware-accelerated native video clock for silky-smooth forward playback
          if (video.paused) {
            video.playbackRate = playbackSpeed;
            video.play().catch(() => {});
          }
          let cur = video.currentTime;
          if (cur >= trimEnd || cur < trimStart - 0.05) {
            if (loopMode === 'pingpong') {
              playDirectionRef.current = -1;
              video.pause();
              cur = trimEnd;
            } else {
              cur = trimStart;
              video.currentTime = trimStart;
            }
          }
          playheadRef.current = cur;
        } else {
          // Smooth synthetic clock for streams, YouTube keyframes, or reverse playback
          if (sourceType === 'video' && video && !video.paused) {
            video.pause();
          }
          const dir =
            loopMode === 'normal' ? 1 : loopMode === 'reverse' ? -1 : playDirectionRef.current;
          let next = playheadRef.current + dt * playbackSpeed * dir;

          if (loopMode === 'normal') {
            playDirectionRef.current = 1;
            if (next >= trimEnd || next < trimStart) next = trimStart;
          } else if (loopMode === 'reverse') {
            playDirectionRef.current = -1;
            if (next <= trimStart || next > trimEnd) next = trimEnd;
          } else if (loopMode === 'pingpong') {
            if (next >= trimEnd) {
              next = trimEnd;
              playDirectionRef.current = -1;
            } else if (next <= trimStart) {
              next = trimStart;
              playDirectionRef.current = 1;
            }
          }

          playheadRef.current = next;
          if (sourceType === 'video' && video && video.readyState >= 2 && !video.seeking) {
            if (Math.abs(video.currentTime - next) > 0.04) {
              video.currentTime = next;
            }
          }
        }
      }

      // Draw current frame directly onto the HTML5 Canvas at full 60fps
      const canvas = canvasRef.current;
      if (canvas && hasLoadedMedia) {
        const ctx = canvas.getContext('2d');
        renderCompositeFrame({
          ctx,
          canvasWidth: targetDimensions.width,
          canvasHeight: targetDimensions.height,
          sourceType,
          videoEl: video,
          ytImages: ytImagesLoaded,
          ytMetadata: { title: mediaTitle, author: youtubeAuthor },
          streamStyle,
          timestamp: playheadRef.current,
          videoDuration,
          trimStart,
          trimEnd,
          filters,
          memeConfig,
          selectedStamp
        });
      }

      // Throttle React UI timecode badge & scrubber needle updates to ~15fps so React never stutters
      if (now - lastUiSyncRef.current > 65) {
        lastUiSyncRef.current = now;
        setDisplayPlayhead(playheadRef.current);
      }

      animId = requestAnimationFrame(tick);
    };

    lastFrameTimeRef.current = performance.now();
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [
    hasLoadedMedia,
    isPlaying,
    isEncoding,
    playbackSpeed,
    loopMode,
    trimStart,
    trimEnd,
    videoDuration,
    targetDimensions,
    sourceType,
    ytImagesLoaded,
    mediaTitle,
    youtubeAuthor,
    streamStyle,
    filters,
    memeConfig,
    selectedStamp
  ]);

  // ============================================================================
  // REAL CLIENT-SIDE GIF FORGING WORKFLOW
  // ============================================================================
  const handleForgeAnimatedGif = useCallback(async () => {
    if (isEncoding || !hasLoadedMedia) return;
    setIsEncoding(true);
    setEncodeProgress(5);
    setIsPlaying(false);

    try {
      const { width, height } = targetDimensions;
      const offscreen = document.createElement('canvas');
      offscreen.width = width;
      offscreen.height = height;
      const offCtx = offscreen.getContext('2d', { willReadFrequently: true });

      const rawDuration = Math.max(0.4, trimEnd - trimStart);
      const forwardFrameCount = Math.min(
        48,
        Math.max(8, Math.round((rawDuration / playbackSpeed) * exportFps))
      );

      const timestamps = [];
      for (let i = 0; i < forwardFrameCount; i++) {
        const ratio = forwardFrameCount === 1 ? 0 : i / (forwardFrameCount - 1);
        const t = trimStart + ratio * (trimEnd - trimStart);
        timestamps.push(t);
      }

      let finalTimestamps = [...timestamps];
      if (loopMode === 'reverse') {
        finalTimestamps = [...timestamps].reverse();
      } else if (loopMode === 'pingpong' && timestamps.length > 2) {
        const backward = [...timestamps].slice(1, -1).reverse();
        finalTimestamps = [...timestamps, ...backward];
      }

      const capturedFrames = [];
      const videoEl = hiddenVideoRef.current;

      for (let idx = 0; idx < finalTimestamps.length; idx++) {
        const ts = finalTimestamps[idx];

        if (sourceType === 'video' && videoEl && videoEl.readyState >= 2) {
          videoEl.currentTime = ts;
          await new Promise((resolve) => {
            const onSeek = () => {
              videoEl.removeEventListener('seeked', onSeek);
              resolve();
            };
            videoEl.addEventListener('seeked', onSeek);
            setTimeout(resolve, 120);
          });
        }

        renderCompositeFrame({
          ctx: offCtx,
          canvasWidth: width,
          canvasHeight: height,
          sourceType,
          videoEl,
          ytImages: ytImagesLoaded,
          ytMetadata: { title: mediaTitle, author: youtubeAuthor },
          streamStyle,
          timestamp: ts,
          videoDuration,
          trimStart,
          trimEnd,
          filters,
          memeConfig,
          selectedStamp
        });

        const imgData = offCtx.getImageData(0, 0, width, height);
        capturedFrames.push(imgData.data);

        setEncodeProgress(Math.round(((idx + 1) / finalTimestamps.length) * 88));
        await new Promise((r) => setTimeout(r, 15));
      }

      const frameDelayMs = Math.round(1000 / exportFps);
      const gifBlob = createAnimatedGifBlob(capturedFrames, width, height, frameDelayMs);

      if (exportedGifUrl) {
        URL.revokeObjectURL(exportedGifUrl);
      }
      const newUrl = URL.createObjectURL(gifBlob);
      const mbStr = (gifBlob.size / (1024 * 1024)).toFixed(2);
      setExportedGifUrl(newUrl);
      setExportedGifSizeMB(mbStr);
      setEncodeProgress(100);
    } catch (err) {
      console.error('GIF Forging error:', err);
    } finally {
      setTimeout(() => {
        setIsEncoding(false);
        setIsPlaying(true);
      }, 350);
    }
  }, [
    isEncoding,
    hasLoadedMedia,
    targetDimensions,
    trimStart,
    trimEnd,
    playbackSpeed,
    exportFps,
    loopMode,
    sourceType,
    ytImagesLoaded,
    mediaTitle,
    youtubeAuthor,
    videoDuration,
    streamStyle,
    filters,
    memeConfig,
    selectedStamp,
    exportedGifUrl
  ]);

  return (
    <div className="min-h-screen bg-[#0c1d16] text-amber-50 flex flex-col font-sans selection:bg-amber-500 selection:text-emerald-950">
      {/* Hidden HTML5 Video Element for Local Video Decoding */}
      <video
        ref={hiddenVideoRef}
        className="hidden"
        muted
        playsInline
        crossOrigin="anonymous"
        onLoadedMetadata={(e) => {
          const dur = e.currentTarget.duration || 10.0;
          setVideoDuration(dur);
          setTrimStart(0.0);
          setTrimEnd(Math.min(dur, 5.0));
          seekPreviewToTimestamp(0.0);
        }}
      />

      {/* TOP HEADER WITH ANIMATED GIF ELF LOGO */}
      <header className="border-b border-amber-500/30 bg-[#091711]/95 backdrop-blur-md sticky top-0 z-40 shadow-lg shadow-black/30">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <AnimatedLogoElf />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-lg sm:text-2xl tracking-tight bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                  GifWorkshop.com
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                  ✨ Free GIF Studio
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/75 hidden sm:block">
                Video &amp; Social Link to Animated GIF with Live Meme Text &amp; Discord/X Auto-Fit
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* 1. TOP LEADERBOARD AD (Directly above the tool) */}
      <div className="w-full px-3 sm:px-6 pt-2">
        <AdSenseLeaderboard positionLabel="Top Leaderboard Ad" />
      </div>

      {/* VERTICAL SINGLE-COLUMN MOBILE & DESKTOP WORKFLOW */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-3 sm:px-6 pb-10 space-y-5">
        {/* STEP 1: UPLOAD VIDEO OR PASTE SOCIAL VIDEO LINK */}
        <section className="bg-[#122a20]/95 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between gap-3 bg-[#091711]/80 p-3 rounded-xl border border-emerald-800/80">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">
                Step 1 • Choose Video Source
              </span>
              <h2 className="text-sm sm:text-base font-extrabold text-amber-300 flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-amber-400 shrink-0" />
                Upload a Video or Paste Any Social Link
              </h2>
              <p className="text-[11px] text-emerald-200/80 mt-0.5">
                Works with MP4, WebM, MOV, YouTube, TikTok, Instagram, X, Facebook &amp; Snapchat
              </p>
            </div>
            <LinkScoutElfIllustration isBusy={socialExtractState === 'extracting'} />
          </div>

          {/* Social URL Input Row (Blank by Default) */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={socialUrl}
              onChange={(e) => {
                setSocialUrl(e.target.value);
                setDetectedPlatform(detectPlatformFromUrl(e.target.value));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleExtractSocialUrl();
              }}
              placeholder="Paste YouTube, TikTok, Instagram, X, Facebook, or Snapchat video link..."
              className="flex-1 bg-[#091711] border border-emerald-700/70 focus:border-amber-400 rounded-xl px-3.5 py-3 text-xs sm:text-sm text-amber-50 placeholder-emerald-500 outline-none"
            />
            <button
              onClick={() => handleExtractSocialUrl()}
              disabled={socialExtractState === 'extracting' || !socialUrl.trim()}
              className="py-3 px-5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 text-emerald-950 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-md"
            >
              <Wand2 className="w-4 h-4" />
              <span>{socialExtractState === 'extracting' ? 'Loading Video...' : 'Load Video Link'}</span>
            </button>
          </div>

          {/* Clean Loaded Video Confirmation Pill */}
          {socialExtractState === 'resolved' && (
            <div className="bg-emerald-950/90 border border-emerald-400/50 rounded-xl p-2.5 flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="truncate">
                  <span className="font-extrabold text-amber-300">{mediaTitle}</span>
                  {youtubeAuthor && (
                    <span className="text-emerald-300/80 ml-1.5">• {youtubeAuthor}</span>
                  )}
                </div>
                {streamNotice && (
                  <div className="text-[11px] text-emerald-300/90 mt-0.5">{streamNotice}</div>
                )}
              </div>
            </div>
          )}

          {/* Honest Notice When YouTube CORS Blocks Raw MP4 Pixels in the Browser Sandbox */}
          {socialExtractState === 'storyboard_fallback' && (
            <div className="bg-amber-950/70 border border-amber-400/60 rounded-xl p-3 flex items-start gap-2.5 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-extrabold text-amber-200">
                  {mediaTitle} {youtubeAuthor ? `• ${youtubeAuthor}` : ''}
                </div>
                <p className="text-[11px] text-amber-100/90 leading-relaxed">
                  {streamNotice}
                </p>
              </div>
            </div>
          )}

          {/* Drag & Drop or Tap Local Video Upload */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFile(true);
            }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={handleDropVideo}
          >
            <label
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed text-xs sm:text-sm font-extrabold transition cursor-pointer ${
                isDraggingFile
                  ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                  : 'border-emerald-700 hover:border-amber-400 bg-[#091711] text-emerald-200'
              }`}
            >
              <Upload className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Or Upload a Video File from Your Device (MP4, WebM, MOV)</span>
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </section>

        {/* LIVE 60FPS VIDEO & MEME PREVIEW STAGE */}
        <section className="bg-[#10261c]/95 border-2 border-amber-500/40 rounded-2xl p-3 sm:p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-xs font-extrabold text-amber-200 truncate">
                Live Preview: {mediaTitle}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-300 shrink-0">
              <span>
                {targetDimensions.width}×{targetDimensions.height}
              </span>
              <span>•</span>
              <span>{playbackSpeed}x</span>
              <span>•</span>
              <span className="uppercase text-amber-300 font-bold">{loopMode}</span>
            </div>
          </div>

          {/* Live 60FPS HTML5 Canvas Viewport */}
          <div className="relative bg-[#06100b] rounded-xl border border-amber-500/30 overflow-hidden flex items-center justify-center h-[230px] sm:h-[340px]">
            <canvas
              ref={canvasRef}
              width={targetDimensions.width}
              height={targetDimensions.height}
              className="max-w-full max-h-full w-auto h-auto object-contain rounded shadow-lg block"
            />

            {/* Play/Pause Floating Button Bottom-Left */}
            <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 z-10">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-8 h-8 rounded-lg bg-amber-400 hover:bg-amber-300 text-emerald-950 flex items-center justify-center shadow-md cursor-pointer"
                aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <button
                onClick={() => {
                  seekPreviewToTimestamp(trimStart);
                  setIsPlaying(true);
                }}
                className="px-2 py-1.5 rounded-lg bg-[#091711]/90 hover:bg-emerald-900 text-emerald-200 text-[11px] font-bold flex items-center gap-1 border border-emerald-700 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Restart Loop</span>
              </button>
            </div>

            {/* Live Timecode & Trim Badge Bottom-Right */}
            <div className="absolute bottom-2.5 right-2.5 bg-[#091711]/90 backdrop-blur-md border border-amber-500/40 px-2.5 py-1 rounded-lg font-mono text-[11px] text-amber-200 flex items-center gap-1.5">
              <span className="text-amber-400 font-bold">{displayPlayhead.toFixed(2)}s</span>
              <span className="text-emerald-500">/</span>
              <span className="text-emerald-300">
                Loop {trimStart.toFixed(1)}s–{trimEnd.toFixed(1)}s
              </span>
            </div>

            {/* Forging Progress Overlay */}
            {isEncoding && (
              <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center z-20">
                <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center mb-2 animate-bounce">
                  <Hammer className="w-6 h-6 text-amber-300" />
                </div>
                <h3 className="text-sm sm:text-base font-black text-amber-300">
                  Workshop Elves Are Crafting Your GIF ({encodeProgress}%)...
                </h3>
                <div className="w-56 h-2.5 bg-emerald-900 rounded-full overflow-hidden mt-2.5 border border-amber-400/40">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-150"
                    style={{ width: `${encodeProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Interactive Filmstrip Timeline Scrubber Right Below Video */}
          <div className="mt-2.5 relative h-8 bg-emerald-950/95 rounded-lg border border-emerald-800 overflow-hidden select-none">
            <div className="absolute inset-x-0 top-1 flex justify-between px-2 opacity-20 pointer-events-none">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="w-2 h-1 bg-amber-200 rounded-xs" />
              ))}
            </div>
            <div className="absolute inset-x-0 bottom-1 flex justify-between px-2 opacity-20 pointer-events-none">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="w-2 h-1 bg-amber-200 rounded-xs" />
              ))}
            </div>

            {/* Highlighted Active Loop Zone */}
            <div
              className="absolute top-0 bottom-0 bg-gradient-to-r from-amber-400/35 via-emerald-400/25 to-amber-400/35 border-x-4 border-amber-400"
              style={{
                left: `${(trimStart / videoDuration) * 100}%`,
                width: `${((trimEnd - trimStart) / videoDuration) * 100}%`
              }}
            />

            {/* Scrubber Touch Slider */}
            <input
              type="range"
              min={0}
              max={videoDuration}
              step={0.02}
              value={displayPlayhead}
              onChange={(e) => {
                setIsPlaying(false);
                seekPreviewToTimestamp(parseFloat(e.target.value));
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
            />

            {/* Golden Playhead Needle */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-300 shadow-[0_0_8px_#fcd34d] pointer-events-none z-10"
              style={{
                left: `${Math.min(100, (displayPlayhead / videoDuration) * 100)}%`
              }}
            >
              <div className="w-3 h-3 rounded-full bg-amber-300 border-2 border-emerald-950 -ml-[5px]" />
            </div>
          </div>
        </section>

        {/* STEP 2: TRIM LOOP, BOOMERANG & SPEED CONTROLS */}
        <section className="bg-[#122a20]/95 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between gap-3 bg-[#091711]/80 p-3 rounded-xl border border-emerald-800/80">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">
                Step 2 • Loop Timing &amp; Speed
              </span>
              <h2 className="text-sm sm:text-base font-extrabold text-amber-300 flex items-center gap-1.5">
                <Scissors className="w-4 h-4 text-amber-400" />
                Select Where to Loop, Reverse, or Speed Up
              </h2>
              <p className="text-[11px] text-emerald-200/80 mt-0.5">
                Drag sliders to preview exact start &amp; end frames in real time
              </p>
            </div>
            <GearCrankElfIllustration speed={playbackSpeed} isReverse={loopMode === 'reverse'} />
          </div>

          {/* Start & End Trim Sliders (Dragging immediately scrubs the preview to that exact frame!) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#091711] p-3.5 rounded-xl border border-emerald-800">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-emerald-300 font-bold">Loop Start (IN)</span>
                <span className="font-mono font-bold text-amber-300">{trimStart.toFixed(2)}s</span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(0.5, videoDuration - 0.5)}
                step={0.1}
                value={trimStart}
                onChange={(e) => {
                  const val = Math.min(parseFloat(e.target.value), trimEnd - 0.4);
                  setTrimStart(val);
                  seekPreviewToTimestamp(val);
                }}
                className="w-full h-2 accent-amber-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-emerald-300 font-bold">Loop End (OUT)</span>
                <span className="font-mono font-bold text-emerald-300">{trimEnd.toFixed(2)}s</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={videoDuration}
                step={0.1}
                value={trimEnd}
                onChange={(e) => {
                  const val = Math.max(parseFloat(e.target.value), trimStart + 0.4);
                  setTrimEnd(val);
                  seekPreviewToTimestamp(val);
                }}
                className="w-full h-2 accent-emerald-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Loop Direction + Speed Multiplier Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 mb-2">
                <Repeat className="w-3.5 h-3.5 text-amber-400" />
                Loop Style
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'normal', name: 'Normal', desc: 'Forward', icon: Repeat },
                  { id: 'pingpong', name: 'Boomerang', desc: 'Fwd + Back', icon: ArrowLeftRight },
                  { id: 'reverse', name: 'Reverse', desc: 'Backwards', icon: RotateCcw }
                ].map((mode) => {
                  const Icon = mode.icon;
                  const active = loopMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => setLoopMode(mode.id)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        active
                          ? 'bg-amber-500/25 border-amber-400 text-white shadow-md'
                          : 'bg-[#091711] border-emerald-800 text-emerald-300 hover:border-emerald-600'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 mb-1 ${active ? 'text-amber-300' : 'text-emerald-500'}`}
                      />
                      <div className="text-xs font-bold">{mode.name}</div>
                      <div className="text-[10px] text-emerald-400/80">{mode.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 mb-2">
                <FastForward className="w-3.5 h-3.5 text-amber-400" />
                Speed Controls
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { speed: 0.5, label: '0.5x' },
                  { speed: 1.0, label: '1x' },
                  { speed: 1.5, label: '1.5x' },
                  { speed: 2.0, label: '2x' }
                ].map((item) => (
                  <button
                    key={item.speed}
                    onClick={() => setPlaybackSpeed(item.speed)}
                    className={`py-3 px-2 rounded-xl border text-xs font-extrabold transition cursor-pointer ${
                      playbackSpeed === item.speed
                        ? 'bg-gradient-to-b from-amber-400 to-amber-500 border-amber-200 text-emerald-950 shadow'
                        : 'bg-[#091711] border-emerald-800 text-emerald-300 hover:border-emerald-600'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 2. MIDDLE LEADERBOARD AD (Right in the middle of the vertical workflow) */}
        <AdSenseLeaderboard positionLabel="Middle Leaderboard Ad" />

        {/* STEP 3: MEME TEXT OVERLAY & VISUAL FILTERS */}
        <section className="bg-[#122a20]/95 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between gap-3 bg-[#091711]/80 p-3 rounded-xl border border-emerald-800/80">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">
                Step 3 • Meme Captions &amp; Crop
              </span>
              <h2 className="text-sm sm:text-base font-extrabold text-amber-300 flex items-center gap-1.5">
                <Type className="w-4 h-4 text-amber-400" />
                Add Classic Top &amp; Bottom Meme Text
              </h2>
              <p className="text-[11px] text-emerald-200/80 mt-0.5">
                Bold Impact font with black outline—rendered live on your preview above
              </p>
            </div>
            <PainterElfIllustration isPainting={isTypingMeme} />
          </div>

          {/* Quick Meme Templates */}
          <div className="flex flex-wrap gap-1.5">
            {MEME_TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                onClick={() => {
                  triggerPaintbrushAnimation();
                  setMemeConfig((prev) => ({
                    ...prev,
                    topText: tpl.top,
                    bottomText: tpl.bottom
                  }));
                }}
                className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-900/70 hover:bg-amber-500/25 text-amber-200 border border-emerald-700 hover:border-amber-400 transition cursor-pointer"
              >
                + {tpl.label}
              </button>
            ))}
            <button
              onClick={() =>
                setMemeConfig((prev) => ({ ...prev, topText: '', bottomText: '' }))
              }
              className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-200 border border-rose-800/60 transition cursor-pointer"
            >
              Clear Captions
            </button>
          </div>

          {/* Top & Bottom Text Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-bold text-emerald-300 block mb-1">
                Top Meme Caption
              </label>
              <input
                type="text"
                value={memeConfig.topText}
                onChange={(e) => {
                  triggerPaintbrushAnimation();
                  setMemeConfig({ ...memeConfig, topText: e.target.value });
                }}
                placeholder="TOP TEXT..."
                className="w-full bg-[#091711] border border-emerald-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white font-bold"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-emerald-300 block mb-1">
                Bottom Meme Caption
              </label>
              <input
                type="text"
                value={memeConfig.bottomText}
                onChange={(e) => {
                  triggerPaintbrushAnimation();
                  setMemeConfig({ ...memeConfig, bottomText: e.target.value });
                }}
                placeholder="BOTTOM TEXT..."
                className="w-full bg-[#091711] border border-emerald-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white font-bold"
              />
            </div>
          </div>

          {/* Font Size & Black Outline Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#091711] p-3.5 rounded-xl border border-emerald-800">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-emerald-300">Caption Font Size</span>
                <span className="font-mono text-amber-300">{memeConfig.fontSize}px</span>
              </div>
              <input
                type="range"
                min={20}
                max={64}
                value={memeConfig.fontSize}
                onChange={(e) =>
                  setMemeConfig({ ...memeConfig, fontSize: Number(e.target.value) })
                }
                className="w-full accent-amber-400"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-emerald-300">Black Outline Thickness</span>
                <span className="font-mono text-amber-300">{memeConfig.strokeWidth}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                value={memeConfig.strokeWidth}
                onChange={(e) =>
                  setMemeConfig({ ...memeConfig, strokeWidth: Number(e.target.value) })
                }
                className="w-full accent-amber-400"
              />
            </div>
          </div>

          {/* Crop Ratio + Corner Stickers + Fun Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <span className="text-[11px] font-bold text-emerald-300 block mb-1.5">
                Aspect Ratio &amp; Effects
              </span>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {['16:9', '1:1', '9:16', '4:3'].map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      aspectRatio === ratio
                        ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                        : 'bg-[#091711] border-emerald-800 text-emerald-400'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => setFilters((f) => ({ ...f, deepFry: !f.deepFry }))}
                  className={`py-2 px-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                    filters.deepFry
                      ? 'bg-orange-500/30 border-orange-400 text-orange-200'
                      : 'bg-[#091711] border-emerald-800 text-emerald-300'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Deep Fry</span>
                </button>
                <button
                  onClick={() => setFilters((f) => ({ ...f, sepia: !f.sepia }))}
                  className={`py-2 px-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                    filters.sepia
                      ? 'bg-amber-700/40 border-amber-400 text-amber-200'
                      : 'bg-[#091711] border-emerald-800 text-emerald-300'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Vintage</span>
                </button>
                <button
                  onClick={() => setFilters((f) => ({ ...f, nightVision: !f.nightVision }))}
                  className={`py-2 px-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                    filters.nightVision
                      ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200'
                      : 'bg-[#091711] border-emerald-800 text-emerald-300'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Night Glow</span>
                </button>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-emerald-300 block mb-1.5">
                Optional Reaction Stamp
              </span>
              <div className="grid grid-cols-6 gap-1.5">
                {REACTION_STAMPS.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setSelectedStamp(st.id)}
                    className={`py-2 rounded-xl border text-center transition cursor-pointer ${
                      selectedStamp === st.id
                        ? 'bg-amber-500/25 border-amber-400 scale-105'
                        : 'bg-[#091711] border-emerald-800 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <div className="text-base">{st.emoji}</div>
                    <div className="text-[9px] text-emerald-200 truncate px-0.5">{st.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* STEP 4: ONE-CLICK DISCORD / REDDIT / X EXPORT & FORGE BUTTON */}
        <section className="bg-[#122a20]/95 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between gap-3 bg-[#091711]/80 p-3 rounded-xl border border-emerald-800/80">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">
                Step 4 • One-Click Platform Export
              </span>
              <h2 className="text-sm sm:text-base font-extrabold text-amber-300 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                Discord (&lt;8MB), X/Twitter (&lt;15MB) &amp; Reddit Presets
              </h2>
              <p className="text-[11px] text-emerald-200/80 mt-0.5">
                Automatic resolution &amp; FPS tuning so your GIF never gets rejected
              </p>
            </div>
            <PressElvesIllustration isUnderLimit={sizeEstimate.isUnderLimit} />
          </div>

          {/* 4 One-Click Platform Presets */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PLATFORM_PRESETS.map((preset) => {
              const active = selectedPlatformId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPlatformPreset(preset)}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    active
                      ? preset.accent
                      : 'bg-[#091711] border-emerald-800 text-emerald-300 hover:border-emerald-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-white">{preset.name}</span>
                    <span className="text-sm">{preset.icon}</span>
                  </div>
                  <div className="text-[10px] mt-1 opacity-90">{preset.tagline}</div>
                  <div className="text-[10px] font-mono mt-1 opacity-75">
                    {preset.resHeight}p • {preset.fps} FPS
                  </div>
                </button>
              );
            })}
          </div>

          {/* Live File Size Bar + Auto-Shrink Button */}
          <div className="bg-[#091711] p-3.5 rounded-xl border border-emerald-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-amber-400" />
                Estimated File Size ({sizeEstimate.totalFrames} frames)
              </span>
              <span
                className={`font-mono font-extrabold ${
                  sizeEstimate.isUnderLimit ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                ~{sizeEstimate.estimatedMB.toFixed(2)} MB / {sizeEstimate.limitMB} MB Limit
              </span>
            </div>

            <div className="w-full h-2.5 bg-emerald-950 rounded-full overflow-hidden border border-emerald-800">
              <div
                className={`h-full transition-all duration-300 ${
                  sizeEstimate.isUnderLimit
                    ? 'bg-gradient-to-r from-emerald-400 to-amber-400'
                    : 'bg-gradient-to-r from-amber-500 to-rose-500'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    (sizeEstimate.estimatedMB / sizeEstimate.limitMB) * 100
                  )}%`
                }}
              />
            </div>

            {!sizeEstimate.isUnderLimit && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-rose-300 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Exceeds {sizeEstimate.limitMB}MB platform limit
                </span>
                <button
                  onClick={handleAutoShrink}
                  className="text-[11px] font-extrabold px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-emerald-950 transition cursor-pointer shadow"
                >
                  ⚡ Auto-Shrink to Fit
                </button>
              </div>
            )}
          </div>

          {/* Primary Create & Export GIF Button */}
          <button
            onClick={handleForgeAnimatedGif}
            disabled={isEncoding || !hasLoadedMedia}
            className="w-full py-4 px-5 rounded-xl font-black text-sm sm:text-base bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-emerald-950 shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer border-2 border-amber-200 active:scale-[0.99]"
          >
            {isEncoding ? (
              <>
                <Hammer className="w-5 h-5 animate-bounce" />
                <span>Crafting Animated GIF ({encodeProgress}%)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>
                  Create &amp; Download Animated GIF (~{sizeEstimate.estimatedMB.toFixed(1)} MB)
                </span>
              </>
            )}
          </button>

          {/* Ready-to-Download GIF Result Card */}
          {exportedGifUrl && (
            <div className="p-4 rounded-xl bg-emerald-900/60 border-2 border-amber-400/70 space-y-3 shadow-lg">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={exportedGifUrl}
                    alt="Forged Animated GIF preview"
                    onClick={() => setShowGifLightbox(true)}
                    className="w-20 h-20 rounded-lg object-cover border-2 border-amber-300 cursor-pointer hover:scale-105 transition"
                    title="Click to inspect full-size animated GIF"
                  />
                  <div>
                    <div className="text-xs sm:text-sm font-extrabold text-amber-300 flex items-center gap-1">
                      <Star className="w-4 h-4 fill-amber-300" />
                      Your Animated GIF Is Ready! ({exportedGifSizeMB} MB)
                    </div>
                    <div className="text-[11px] text-emerald-200">
                      {targetDimensions.width}×{targetDimensions.height} • {exportFps} FPS •{' '}
                      {loopMode.toUpperCase()} Loop
                    </div>
                    <button
                      onClick={() => setShowGifLightbox(true)}
                      className="mt-1 text-[11px] font-bold text-amber-300 underline hover:text-amber-200 cursor-pointer"
                    >
                      🔍 Click to View Full-Size Animated GIF Here
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setShowGifLightbox(true)}
                    className="w-full sm:w-auto justify-center px-3.5 py-2.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300 text-amber-200 font-bold text-xs flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Preview Animation</span>
                  </button>
                  <a
                    href={exportedGifUrl}
                    download={`GifWorkshop-${Date.now()}.gif`}
                    className="w-full sm:w-auto justify-center px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-emerald-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shrink-0 transition shadow-md"
                  >
                    <Download className="w-4 h-4" />
                    <span>Save .GIF File</span>
                  </a>
                </div>
              </div>

              {/* Helpful Mac User Tip Explaining Apple Preview.app Behavior */}
              <div className="bg-[#091711]/90 border border-emerald-700/80 rounded-lg px-3 py-2 text-[11px] text-emerald-200/90 flex items-start gap-2">
                <span className="text-amber-300 font-bold shrink-0">🍎 Mac Tip:</span>
                <span>
                  On macOS, double-clicking a <code className="text-amber-300">.gif</code> opens Apple&apos;s{' '}
                  <strong>Preview</strong> app, which shows every frame separately as a list. To watch it animate on your Mac, select the file in Finder and press{' '}
                  <strong className="text-amber-300">Spacebar</strong> (Quick Look), or drag it into{' '}
                  <strong>Safari, Chrome, Messages, or Discord</strong>!
                </span>
              </div>
            </div>
          )}
        </section>

        {/* FULL-SIZE ANIMATED GIF LIGHTBOX MODAL */}
        {showGifLightbox && exportedGifUrl && (
          <div
            onClick={() => setShowGifLightbox(false)}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[#10261c] border-2 border-amber-400 rounded-2xl max-w-2xl w-full p-4 space-y-3 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-black text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Live Animated GIF Verification ({exportedGifSizeMB} MB)
                </h3>
                <button
                  onClick={() => setShowGifLightbox(false)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-amber-200 text-xs font-bold cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>
              <div className="bg-black rounded-xl overflow-hidden flex items-center justify-center max-h-[65vh] p-2">
                <img
                  src={exportedGifUrl}
                  alt="Full size animated GIF"
                  className="max-w-full max-h-[60vh] object-contain rounded"
                />
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-emerald-200">
                <span>
                  This is the actual binary <code className="text-amber-300">.gif</code> file rendered natively by your browser.
                </span>
                <a
                  href={exportedGifUrl}
                  download={`GifWorkshop-${Date.now()}.gif`}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black text-xs flex items-center gap-1.5 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .GIF</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* 3. BOTTOM LEADERBOARD AD (Directly below the tool) */}
        <AdSenseLeaderboard positionLabel="Bottom Leaderboard Ad" />
      </main>

      {/* CLEAN CONSUMER FOOTER */}
      <footer className="border-t border-emerald-900/80 bg-[#08130e] py-4 px-4 text-xs text-emerald-400/80">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-300">GifWorkshop.com</span>
            <span>•</span>
            <span>Free Online Video &amp; Social Link to Animated GIF Maker</span>
          </div>
          <span className="text-[11px] text-emerald-500">
            100% Browser-Powered • Discord, X &amp; Reddit Ready
          </span>
        </div>
      </footer>
    </div>
  );
}

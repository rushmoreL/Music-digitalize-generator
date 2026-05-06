import { useEffect, useRef } from 'react';

interface AudioAnalysis {
  data: Uint8Array;
  pitch: number;
  timbre: number;
  energy: number;
}

interface AudioVisualizerProps {
  analysis: AudioAnalysis | null;
  isPlaying: boolean;
  threshold: number;
}

export default function AudioVisualizer({ analysis, isPlaying, threshold }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const glitchesRef = useRef<any[]>([]);
  const frameRef = useRef<number>(0);
  const sphereGlitchesRef = useRef<Map<string, { color: string; remaining: number }>>(new Map());

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Increment time for rotation and motion
    timeRef.current += 0.005;
    const t = timeRef.current;

    // Default values if no analysis
    const energy = analysis?.energy || 0.05;
    const isInverse = energy > threshold;
    const bgColor = isInverse ? '#FFFFFF' : '#000000';
    const fgColor = isInverse ? '#000000' : '#FFFFFF';

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    const data = analysis?.data || new Uint8Array(1024).fill(20);
    const pitch = analysis?.pitch || 0;
    const timbre = analysis?.timbre || 0.1;

    // 1. BACKGROUND GRID (Always drawn as background)
    const cellSize = 24; 
    const cols = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);
    const margin = 1;

    // Fixed 6 centers for patch-like appearance
      const centers = [
        { x: 0.15, y: 0.2 },
        { x: 0.85, y: 0.25 },
        { x: 0.5, y: 0.5 },
        { x: 0.2, y: 0.8 },
        { x: 0.8, y: 0.75 },
        { x: 0.4, y: 0.15 }
      ];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const xFactor = c / cols;
          const yFactor = r / rows;
          
          // Calculate proximity to the nearest random center
          let minDist = 2;
          for (const center of centers) {
            const dx = xFactor - center.x;
            const dy = yFactor - center.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < minDist) minDist = d;
          }

          // Reach grows with energy - centers of expansion
          const reach = 0.2 + energy * 0.8;
          const proximityFactor = Math.max(0, 1 - (minDist / reach));

          const dataIndex = Math.floor((xFactor * 0.5 + yFactor * 0.5) * data.length);
          const rawVal = data[dataIndex % data.length] / 255;
          
          const baseIntensity = 0.2 + Math.sin(t * 0.2) * 0.05;
          const val = Math.max(0, Math.min(1, (rawVal * 0.7 + baseIntensity + energy * 0.3) * proximityFactor));

          // In sphere mode, reduce background grid density
          const thresholdVal = 0.4;
          if (val < thresholdVal) continue;

          const baseSize = cellSize - margin * 2;
          const size = baseSize * 0.6;
          const px = c * cellSize + cellSize / 2;
          const py = r * cellSize + cellSize / 2;
          
          renderPattern(ctx, px, py, size, val, timbre, c, r, cols, rows, fgColor, bgColor);
        }
      }

    // 2. FOREGROUND SPHERE
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.35;
    const radius = baseRadius * (0.9 + energy * 0.3);
      
      const latitudes = 24;
      const longitudes = 28;
      const sphereCellSize = (radius * 2 * Math.PI) / longitudes / 2.5;

      const rotX = t * 0.4;
      const rotY = t * 0.6;

      for (let i = 0; i <= latitudes; i++) {
          const phi = (i / latitudes) * Math.PI;
          const sinPhi = Math.sin(phi);
          const cosPhi = Math.cos(phi);

          for (let j = 0; j < longitudes; j++) {
              const theta = (j / longitudes) * 2 * Math.PI;
              const sinTheta = Math.sin(theta);
              const cosTheta = Math.cos(theta);

              // Simple multi-octave noise for "landmass" effect
              const landNoise = 
                Math.sin(theta * 3) * Math.cos(phi * 2) * 0.5 + 
                Math.sin(theta * 7 + phi * 3) * 0.3 + 
                Math.cos(theta * 12 - phi * 8) * 0.2;
              
              const isLand = landNoise > 0.1;

              let x = radius * sinPhi * cosTheta;
              let y = radius * cosPhi;
              let z = radius * sinPhi * sinTheta;

              let x1 = x * Math.cos(rotY) + z * Math.sin(rotY);
              let z1 = -x * Math.sin(rotY) + z * Math.cos(rotY);
              let y2 = y * Math.cos(rotX) - z1 * Math.sin(rotX);
              let z2 = y * Math.sin(rotX) + z1 * Math.cos(rotX);

              if (z2 > -radius * 0.5) {
                  const screenX = centerX + x1;
                  const screenY = centerY + y2;

                  const lonFactor = j / longitudes;
                  const latFactor = i / latitudes;
                  const dataIndex = Math.floor((lonFactor * 0.5 + latFactor * 0.5) * data.length);
                  const rawVal = data[dataIndex % data.length] / 255;
                  
                  const baseIntensity = 0.3 + Math.sin(t * 0.5 + i * 0.2) * 0.05;
                  const val = Math.max(0, Math.min(1, rawVal * 0.7 + baseIntensity + energy * 0.5));

                  if (val < 0.3) continue;

                  // Landmasses are larger, oceans are sparser/smaller
                  const sizeFactor = isLand ? 1.6 : 0.4;
                  const size = sphereCellSize * (0.4 + val * 0.6) * sizeFactor;
                  
                  // Manage persistent color glitches on the sphere
                  const key = `${i}-${j}`;
                  let elementColor = fgColor;
                  
                  // Check if this element has a persistent glitch
                  const activeGlitch = sphereGlitchesRef.current.get(key);
                  if (activeGlitch) {
                    elementColor = activeGlitch.color;
                  } else if (Math.random() < 0.002 * energy) {
                    // Try to spawn a new persistent glitch
                    const colors = ['#FF3B30', '#007AFF', '#FFCC00'];
                    const newColor = colors[Math.floor(Math.random() * colors.length)];
                    sphereGlitchesRef.current.set(key, { 
                      color: newColor, 
                      remaining: 60 + Math.floor(Math.random() * 120) 
                    });
                    elementColor = newColor;
                  }

                  renderPattern(ctx, screenX, screenY, size, val, timbre, j, i, longitudes, latitudes, elementColor, bgColor);
              }
          }
      }

      // Cleanup expired sphere glitches
      sphereGlitchesRef.current.forEach((glitch, key) => {
        glitch.remaining--;
        if (glitch.remaining <= 0) {
          sphereGlitchesRef.current.delete(key);
        }
      });

    // 3. GLITCH RECTANGLES (Global Top Layer)
    if (energy > 0.15) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = 1.0; 
      
      // Only update glitch positions every 8 frames to reduce speed
      if (frameRef.current % 8 === 0) {
        const numGlitches = Math.floor(energy * 20);
        glitchesRef.current = [];
        for (let g = 0; g < numGlitches; g++) {
          const side = Math.random() > 0.5 ? 'left' : 'right';
          const gx = side === 'left' ? Math.random() * (width * 0.3) : width - Math.random() * (width * 0.3);
          const gy = height * 0.25 + Math.random() * (height * 0.5);
          const gw = 20 + Math.random() * 250 * energy;
          const gh = 2 + Math.random() * 20 * energy;
          const lineWidth = Math.random() > 0.7 ? 3 : 1;
          const glitchType = Math.random();
          const hasLine = Math.random() > 0.8;

          glitchesRef.current.push({ gx, gy, gw, gh, lineWidth, glitchType, hasLine });
        }
      }

      // Draw stored glitches
      glitchesRef.current.forEach(g => {
        ctx.lineWidth = g.lineWidth;
        if (g.glitchType > 0.6) {
          ctx.strokeRect(g.gx - g.gw / 2, g.gy - g.gh / 2, g.gw, g.gh);
        } else if (g.glitchType > 0.3) {
          ctx.fillRect(g.gx - g.gw / 2, g.gy - g.gh / 2, g.gw / 5, g.gh);
        } else {
          ctx.strokeRect(g.gx - g.gw / 2, g.gy - g.gh / 2, g.gw, g.gh);
          ctx.strokeRect(g.gx - g.gw / 4, g.gy - g.gh / 4, g.gw / 2, g.gh / 2);
        }
        
        if (g.hasLine) {
          ctx.beginPath();
          ctx.lineWidth = 0.5;
          ctx.moveTo(0, g.gy);
          ctx.lineTo(width, g.gy);
          ctx.stroke();
        }
      });
      
      ctx.globalAlpha = 1.0;
    }

    frameRef.current++;
    requestRef.current = requestAnimationFrame(draw);
  };

  const renderPattern = (
    ctx: CanvasRenderingContext2D, 
    centerX: number, 
    centerY: number, 
    size: number, 
    val: number, 
    timbre: number,
    c: number,
    r: number,
    cols: number,
    rows: number,
    fgColor: string,
    bgColor: string
  ) => {
    const px = centerX - size / 2;
    const py = centerY - size / 2;

    ctx.strokeStyle = fgColor;
    ctx.fillStyle = fgColor;
    ctx.lineWidth = 1;

    const symC = Math.abs(c - (cols - 1) / 2);
    const symR = Math.abs(r - (rows - 1) / 2);
    let patternType = Math.floor((timbre * 5 + (symC + symR) * 0.2) % 8);

    if (patternType === 1 && Math.floor(symC + symR) % 2 === 0) patternType = 6;
    if (patternType === 4 && Math.floor(symC + symR) % 2 !== 0) patternType = 7;

    switch(patternType) {
        case 0: ctx.fillRect(px, py, size, size); break;
        case 1: {
            const subSize = size / 3;
            ctx.beginPath();
            for(let k=1; k<3; k++) {
                ctx.moveTo(px + k*subSize, py); ctx.lineTo(px + k*subSize, py + size);
                ctx.moveTo(px, py + k*subSize); ctx.lineTo(px + size, py + k*subSize);
            }
            ctx.stroke();
            break;
        }
        case 2:
            ctx.beginPath();
            ctx.moveTo(px, py); ctx.lineTo(px + size, py + size);
            ctx.moveTo(px, py + size / 2); ctx.lineTo(px + size / 2, py + size);
            ctx.stroke();
            break;
        case 3:
            ctx.beginPath(); ctx.arc(centerX, centerY, size / 2.5, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(centerX, centerY, size / 5, 0, Math.PI * 2); ctx.stroke();
            break;
        case 4:
            ctx.strokeRect(px, py, size, size);
            ctx.beginPath();
            ctx.moveTo(px, py); ctx.lineTo(px + size, py + size);
            ctx.moveTo(px + size, py); ctx.lineTo(px, py + size);
            ctx.stroke();
            break;
        case 5:
            ctx.beginPath(); ctx.moveTo(centerX, py); ctx.lineTo(px + size, centerY);
            ctx.lineTo(centerX, py + size); ctx.lineTo(px, centerY); ctx.closePath();
            if (val > 0.6) ctx.fill(); else ctx.stroke();
            break;
        case 6:
            ctx.fillRect(px, py, size, size);
            ctx.fillStyle = bgColor;
            ctx.beginPath(); ctx.arc(centerX, centerY, size / 4.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = fgColor;
            break;
        case 7:
            ctx.beginPath(); ctx.arc(centerX, centerY, size / 3.5, 0, Math.PI * 2);
            if (val > 0.6) ctx.fill(); else ctx.stroke();
            break;
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    requestRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, analysis, threshold]); // Added threshold to deps

  return (
    <canvas
      ref={canvasRef}
      id="visualizer-canvas"
      className="fixed inset-0 z-0 bg-black"
    />
  );
}

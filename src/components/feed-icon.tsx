import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName = 'play' | 'pause' | 'close' | 'shuffle' | 'refresh' | 'sound' | 'muted' | 'check' | 'video' | 'arrow' | 'filter' | 'bookmark' | 'repeat' | 'auto' | 'share';

export function FeedIcon({ name, size = 24, color = '#FFFFFF', filled = false }: { name: IconName; size?: number; color?: string; filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'play' && <Path d="M8 5.5v13l10-6.5L8 5.5Z" fill={color} stroke={color} strokeWidth={1.5} strokeLinejoin="round" />}
      {name === 'pause' && <><Rect x={6} y={5} width={4} height={14} rx={1} fill={color} /><Rect x={14} y={5} width={4} height={14} rx={1} fill={color} /></>}
      {name === 'filter' && <><Path d="M4 6h16M4 12h16M4 18h16" stroke={color} strokeWidth={1.7} strokeLinecap="round" /><Circle cx={8} cy={6} r={2} fill="#000000" stroke={color} strokeWidth={1.7} /><Circle cx={16} cy={12} r={2} fill="#000000" stroke={color} strokeWidth={1.7} /><Circle cx={10} cy={18} r={2} fill="#000000" stroke={color} strokeWidth={1.7} /></>}
      {name === 'bookmark' && <Path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4V4Z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" fill={filled ? color : 'none'} />}
      {name === 'repeat' && <Path d="m16 2 4 4-4 4M20 6H7a3 3 0 0 0-3 3v2m4 11-4-4 4-4M4 18h13a3 3 0 0 0 3-3v-2" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />}
      {name === 'auto' && <><Rect x={4} y={3} width={11} height={17} rx={3} stroke={color} strokeWidth={1.6} /><Path d="m8 8 4 3-4 3V8Z" fill={color} /><Path d="M20 6v12m-3-3 3 3 3-3" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></>}
      {name === 'share' && <><Path d="m9 7 6-3m-6 9 6 6" stroke={color} strokeWidth={1.7} /><Circle cx={6} cy={10} r={3} stroke={color} strokeWidth={1.7} /><Circle cx={18} cy={4} r={3} stroke={color} strokeWidth={1.7} /><Circle cx={18} cy={20} r={3} stroke={color} strokeWidth={1.7} /></>}
      {name === 'close' && <Path d="m6 6 12 12M18 6 6 18" stroke={color} strokeWidth={1.8} strokeLinecap="round" />}
      {name === 'shuffle' && <Path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c1.8 0 3.2-1.8 4.5-4M14 8c1.3-1.3 2.5-2 4-2h3m-4-4 4 4-4 4" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />}
      {name === 'refresh' && <Path d="M20 10a8 8 0 1 0-.7 6M20 4v6h-6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}
      {(name === 'sound' || name === 'muted') && <><Path d="M4 9h4l5-4v14l-5-4H4V9Z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />{name === 'sound' ? <Path d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" stroke={color} strokeWidth={1.7} strokeLinecap="round" /> : <Path d="m17 9 5 6m0-6-5 6" stroke={color} strokeWidth={1.7} strokeLinecap="round" />}</>}
      {name === 'check' && <Path d="m5 12 4 4L19 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
      {name === 'video' && <><Rect x={3} y={3} width={18} height={18} rx={5} stroke={color} strokeWidth={1.5} /><Path d="m10 8 6 4-6 4V8Z" fill={color} /></>}
      {name === 'arrow' && <Path d="M12 20V4m-6 6 6-6 6 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}
    </Svg>
  );
}

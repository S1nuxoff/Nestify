// Іконки плеєра: сітка 24×24, лінія 1.8, основні дії залиті.

function Line({ size = 24, children, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

function Solid({ size = 24, children, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const BackIcon = (props) => (
  <Line {...props}><path d="M15 5l-7 7 7 7" /></Line>
);

export const PlayIcon = (props) => (
  <Solid {...props}><path d="M7 4.6c0-1 1.1-1.7 2-1.1l11.2 7.4c.8.5.8 1.7 0 2.2L9 20.5c-.9.6-2-.1-2-1.1V4.6z" /></Solid>
);

export const PauseIcon = (props) => (
  <Solid {...props}>
    <rect x="5.5" y="3.5" width="4.6" height="17" rx="1.4" />
    <rect x="13.9" y="3.5" width="4.6" height="17" rx="1.4" />
  </Solid>
);

const SECONDS_TEXT = { fontSize: 7.4, fontWeight: 700, fontFamily: "inherit", letterSpacing: "-0.02em" };

export const Replay10Icon = (props) => (
  <Line {...props}>
    <path d="M4.2 8.2A9 9 0 1 1 3 12.6" />
    <path d="M4 3.6v4.8h4.8" />
    <text x="12.2" y="15.1" textAnchor="middle" fill="currentColor" stroke="none" style={SECONDS_TEXT}>10</text>
  </Line>
);

export const Forward10Icon = (props) => (
  <Line {...props}>
    <path d="M19.8 8.2A9 9 0 1 0 21 12.6" />
    <path d="M20 3.6v4.8h-4.8" />
    <text x="11.8" y="15.1" textAnchor="middle" fill="currentColor" stroke="none" style={SECONDS_TEXT}>10</text>
  </Line>
);

export const VolumeIcon = (props) => (
  <Line {...props}>
    <path d="M4 9.8v4.4c0 .5.4.8.8.8h2.9l4.2 3.5c.5.4 1.1.1 1.1-.6V6.1c0-.7-.7-1-1.1-.6L7.7 9H4.800c-.4 0-.8.3-.8.8z" fill="currentColor" />
    <path d="M16.5 9a4.2 4.2 0 0 1 0 6" />
    <path d="M19 6.500a7.8 7.8 0 0 1 0 11" />
  </Line>
);

export const MutedIcon = (props) => (
  <Line {...props}>
    <path d="M4 9.800v4.400c0 .5.4.8.8.8h2.900l4.2 3.500c.5.4 1.1.1 1.1-.6V6.100c0-.7-.7-1-1.1-.6L7.7 9H4.800c-.4 0-.8.3-.8.8z" fill="currentColor" />
    <path d="M16.5 9.500l5 5" />
    <path d="M21.5 9.500l-5 5" />
  </Line>
);

export const NextIcon = (props) => (
  <Solid {...props}>
    <path d="M5 5.700c0-.9 1-1.5 1.8-1l9 5.700c.7.5.7 1.6 0 2.100l-9 5.800c-.8.5-1.8-.1-1.8-1V5.700z" />
    <rect x="17.5" y="4.3" width="2.5" height="15.4" rx="1.1" />
  </Solid>
);

export const EpisodesIcon = (props) => (
  <Line {...props}>
    <rect x="3" y="8.5" width="18" height="11.5" rx="2.5" />
    <path d="M6.5 5.500h11" />
    <path d="M9 3h6" />
    <path d="M10.5 12v4.500l3.8-2.250z" fill="currentColor" />
  </Line>
);

export const AudioSubtitlesIcon = (props) => (
  <Line {...props}>
    <path d="M5.5 4h13A2.5 2.5 0 0 1 21 6.500v8.500a2.5 2.5 0 0 1-2.5 2.500H11l-4.3 3c-.5.3-1.2 0-1.2-.7v-2.300A2.5 2.5 0 0 1 3 15V6.500A2.5 2.5 0 0 1 5.5 4z" />
    <path d="M7.5 9h5" />
    <path d="M15 9h1.5" />
    <path d="M7.5 12.800h2" />
    <path d="M12 12.800h4.5" />
  </Line>
);

export const QualityIcon = (props) => (
  <Line {...props}>
    <path d="M4 7h9" />
    <path d="M18 7h2" />
    <circle cx="15.5" cy="7" r="2.5" />
    <path d="M4 17h2" />
    <path d="M11 17h9" />
    <circle cx="8.5" cy="17" r="2.5" />
  </Line>
);

export const FullscreenIcon = (props) => (
  <Line {...props}>
    <path d="M4 9V6a2 2 0 0 1 2-2h3" />
    <path d="M15 4h3a2 2 0 0 1 2 2v3" />
    <path d="M20 15v3a2 2 0 0 1-2 2h-3" />
    <path d="M9 20H6a2 2 0 0 1-2-2v-3" />
  </Line>
);

export const ExitFullscreenIcon = (props) => (
  <Line {...props}>
    <path d="M9 4v3a2 2 0 0 1-2 2H4" />
    <path d="M20 9h-3a2 2 0 0 1-2-2V4" />
    <path d="M15 20v-3a2 2 0 0 1 2-2h3" />
    <path d="M4 15h3a2 2 0 0 1 2 2v3" />
  </Line>
);

export const CloseIcon = (props) => (
  <Line {...props}><path d="M6 6l12 12" /><path d="M18 6L6 18" /></Line>
);

export const CheckIcon = (props) => (
  <Line {...props}><path d="M5 12.500l4.5 4.500L19 7.5" /></Line>
);

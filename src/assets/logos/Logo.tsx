import logo from './ei_logo.png';

interface LogoProps {
  className?: string;
  heightPx?: number;
  maxWidthPx?: number;
  /** When the rail is narrow, anchor left to show the EI monogram. */
  objectPosition?: 'left' | 'center';
}

const Logo = ({
  className = '',
  heightPx = 44,
  maxWidthPx = 240,
  objectPosition = 'center',
}: LogoProps): JSX.Element => (
  <img
    src={logo}
    alt="Esthetic Insights"
    width={240}
    height={72}
    loading="lazy"
    className={className}
    style={{
      height: `${heightPx}px`,
      width: 'auto',
      maxWidth: `${maxWidthPx}px`,
      objectFit: 'contain',
      objectPosition,
    }}
  />
);

export default Logo;

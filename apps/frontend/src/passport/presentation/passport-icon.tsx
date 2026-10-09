import { Image } from 'react-native';

const icons = {
  academy: require('../../../assets/passport/icons/shield-star.png'),
  location: require('../../../assets/passport/icons/map-pin.png'),
  foot: require('../../../assets/passport/icons/shoe.png'),
  radar: require('../../../assets/passport/icons/chart-radar.png'),
  chart: require('../../../assets/passport/icons/chart-bar.png'),
  football: require('../../../assets/passport/icons/ball-football.png'),
  target: require('../../../assets/passport/icons/target.png'),
  team: require('../../../assets/passport/icons/users.png'),
  video: require('../../../assets/passport/icons/video.png'),
  lock: require('../../../assets/passport/icons/lock.png'),
  info: require('../../../assets/passport/icons/info-circle.png'),
  more: require('../../../assets/passport/icons/dots-vertical.png'),
  next: require('../../../assets/passport/icons/chevron-right.png'),
  back: require('../../../assets/passport/icons/arrow-left.png'),
  history: require('../../../assets/passport/icons/file-description.png'),
  calendar: require('../../../assets/passport/icons/calendar.png'),
} as const;

export type PassportIconName = keyof typeof icons;

/** Official MIT Tabler raster assets work on native without a new SVG dependency. */
export function PassportIcon({ name, size = 24, color = '#BED0D4' }: { name: PassportIconName; size?: number; color?: string }) {
  return <Image accessible={false} source={icons[name]} resizeMode="contain" style={{ width: size, height: size, tintColor: color, flexShrink: 0 }} />;
}

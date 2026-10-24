/** Everything the scroll timeline animates. Plain numbers so GSAP can tween and scrub them. */
export const story = {
  arrive: 0,
  backup: 0,
  depart: 0,
  slide: 0,
  tilt: 0,
  cable: 0,
  winch: 0,
  beacons: 0,
  brake: 0,
  reverse: 0,
  smoke: 1,
  dawn: 0,
  camFollow: 0,
  lookTruck: 0,
  cam: { x: 7.5, y: 1.3, z: -14.5, tx: 0.4, ty: 0.9, tz: -5.4 },
};
export type Story = typeof story;

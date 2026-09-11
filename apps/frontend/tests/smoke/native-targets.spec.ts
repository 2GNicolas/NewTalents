import app from '../../app.json';

describe('native target configuration', () => {
  it('declares Android and iOS as supported Expo targets', () => {
    expect(app.expo.platforms).toEqual(expect.arrayContaining(['android', 'ios', 'web']));
  });

  it.skip('starts Android on an available emulator or device (no Android target attached on this host)', () => undefined);
  it.skip('starts iOS in Simulator (unsupported on this Windows host)', () => undefined);
});

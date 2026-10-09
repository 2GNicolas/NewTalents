import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Slot, useLocalSearchParams } from 'expo-router';

import { authTokens } from '../../../../src/design/tokens';
import { usePassportState } from '../../../../src/passport/passport-state';

export default function PassportIdentityShellLayout() {
  const { passportId } = useLocalSearchParams<{ passportId?: string }>();
  const passport = usePassportState();

  useEffect(() => {
    if (passportId) void passport.selectPassport(passportId);
  }, [passportId, passport.selectPassport]);

  return (
    <View style={styles.shell}>
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: authTokens.colors.canvasDeep,
    flex: 1,
    minHeight: '100%',
    width: '100%',
  },
});
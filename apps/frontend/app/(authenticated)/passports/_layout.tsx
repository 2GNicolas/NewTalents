import { Slot } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAuthentication } from '../../../src/authentication/authentication-provider';
import { authTokens } from '../../../src/design/tokens';
import { PassportStateProvider } from '../../../src/passport/passport-state';

export default function PassportsLayout() {
  const authentication = useAuthentication();
  return (
    <PassportStateProvider dependencies={{ getAccessToken: () => authentication.getAccessToken() }}>
      <View style={styles.shell}>
        <Slot />
      </View>
    </PassportStateProvider>
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
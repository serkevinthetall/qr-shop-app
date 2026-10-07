import { LogBox } from 'react-native';

/**
 * NativeWind's react-native-css-interop touches `react-native`'s deprecated
 * SafeAreaView getter at load time (our screens already use
 * react-native-safe-area-context). Silence that one-shot LogBox noise.
 * Must import this module before `global.css` / NativeWind.
 */
LogBox.ignoreLogs(['SafeAreaView has been deprecated']);

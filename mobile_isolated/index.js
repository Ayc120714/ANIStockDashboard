import 'react-native-get-random-values';
import {AppRegistry, LogBox} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';

LogBox.ignoreLogs([
  'Require cycle',
  'Non-serializable values were found in the navigation state',
  'ViewPropTypes will be removed',
  'ColorPropType will be removed',
  'AsyncStorage has been extracted',
  'new NativeEventEmitter',
  'EventEmitter.removeListener',
]);

AppRegistry.registerComponent(appName, () => App);

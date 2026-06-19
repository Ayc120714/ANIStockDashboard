import {
  getRootNavigation,
  isInsideMainTabs,
  navigateFromInboxItem,
  navigateToMainTab,
} from '@nav/navigationHelpers';
import {INBOX_SOURCES} from '@core/utils/alertInboxUtils';

function mockTabNavigation() {
  const navigate = jest.fn();
  return {
    navigate,
    getState: () => ({
      routes: [
        {name: 'Dashboard'},
        {name: 'Stocks'},
        {name: 'Signals'},
      ],
      index: 0,
    }),
    getParent: () => null,
  };
}

function mockStackNavigation() {
  const navigate = jest.fn();
  const rootNavigate = jest.fn();
  const tabNav = mockTabNavigation();
  tabNav.getParent = () => ({
    navigate: rootNavigate,
    getParent: () => null,
    getState: () => ({
      routes: [{name: 'MainTabs'}],
      index: 0,
    }),
  });
  return {stack: {navigate, getState: () => ({routes: [{name: 'MainTabs'}]}), getParent: () => null}, tabNav, rootNavigate};
}

describe('navigationHelpers', () => {
  it('detects bottom-tab navigator state', () => {
    expect(isInsideMainTabs(mockTabNavigation())).toBe(true);
    expect(isInsideMainTabs({getState: () => ({routes: [{name: 'MainTabs'}]})})).toBe(false);
  });

  it('navigates directly to sibling tabs when already inside MainTabs', () => {
    const navigation = mockTabNavigation();
    navigateToMainTab(navigation, 'Advisor', {advisorTab: 'sig'});
    expect(navigation.navigate).toHaveBeenCalledWith({
      name: 'Advisor',
      params: {advisorTab: 'sig'},
      merge: true,
    });
  });

  it('navigates via MainTabs wrapper from root stack', () => {
    const {stack} = mockStackNavigation();
    navigateToMainTab(stack, 'Signals');
    expect(stack.navigate).toHaveBeenCalledWith('MainTabs', {screen: 'Signals'});
  });

  it('routes inbox admin alerts through the root stack', () => {
    const {tabNav, rootNavigate} = mockStackNavigation();
    navigateFromInboxItem(tabNav, {source: INBOX_SOURCES.ADMIN}, null);
    expect(rootNavigate).toHaveBeenCalledWith('Admin');
  });

  it('routes inbox advisor alerts to the Advisor tab from tab navigation', () => {
    const navigation = mockTabNavigation();
    navigateFromInboxItem(
      navigation,
      {source: INBOX_SOURCES.SIG_B1},
      {type: 'advisor', advisorTab: 'sig', trendTf: 'daily'},
    );
    expect(navigation.navigate).toHaveBeenCalledWith({
      name: 'Advisor',
      params: {advisorTab: 'sig', trendTf: 'daily'},
      merge: true,
    });
  });

  it('walks parent navigators to find root', () => {
    const root = {navigate: jest.fn()};
    const mid = {getParent: () => root};
    const leaf = {getParent: () => mid};
    expect(getRootNavigation(leaf)).toBe(root);
  });
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('uuid', () => ({
  v4: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
}));

jest.mock('@core/api/services/advisorService', () => ({
  advisorService: {},
}));

jest.mock('@core/api/services/signalsService', () => ({
  signalsService: {},
}));

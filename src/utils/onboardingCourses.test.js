import { defaultOnboardingCourses, resolveOnboardingCourses } from './onboardingCourses';

describe('onboardingCourses', () => {
  it('includes Chapter 1 candlestick patterns video at the top of the default list', () => {
    const chapter1 = defaultOnboardingCourses[0];
    expect(chapter1).toMatchObject({
      id: 'chapter1-candlestick-patterns',
      title: 'Chapter 1: Complete Candlestick Patterns (Episode 1)',
      url: 'https://youtu.be/SO0R7XANb20',
    });
  });

  it('keeps existing Chapter 3 ADX DI course in the default list', () => {
    const adx = defaultOnboardingCourses.find((course) => course.id === 'chapter3-adx-di');
    expect(adx).toMatchObject({
      title: 'Chapter 3: ADX DI',
      url: 'https://youtu.be/O0I1XMgVDg8',
    });
  });

  it('uses env overrides when REACT_APP_ONBOARDING_COURSE_LINKS is set', () => {
    const courses = resolveOnboardingCourses('https://youtu.be/example12345');
    expect(courses).toEqual([
      { id: 'env-1', title: 'Course 1', url: 'https://youtu.be/example12345' },
    ]);
  });
});

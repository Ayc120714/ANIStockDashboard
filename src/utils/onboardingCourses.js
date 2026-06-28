export const defaultOnboardingCourses = [
  {
    id: 'chapter1-candlestick-patterns',
    title: 'Chapter 1: Complete Candlestick Patterns (Episode 1)',
    url: 'https://youtu.be/SO0R7XANb20',
  },
  {
    id: 'fundamentals-playlist',
    title: 'Course 1: Fundamental Analysis (52 videos)',
    url: 'https://www.youtube.com/playlist?list=PLggxfrdV-9sv-uROt8YpO-0hBcDErT2p9',
  },
  {
    id: 'fundamentals-extra',
    title: 'Course 1: Fundamental Analysis (Additional session)',
    url: 'https://www.youtube.com/watch?v=rRzt5rfAX3Q&list=PLggxfrdV-9svmAbnOvE_WBvae-C-xMKVS',
  },
  {
    id: 'ta-basic',
    title: 'Course 2: Technical Analysis Basics',
    url: 'https://www.youtube.com/watch?v=82SqXcKaadU&list=PLggxfrdV-9suY4CBhkq0jup966IzoxHhX',
  },
  {
    id: 'ta-volume-analysis',
    title: 'Course 2: Volume Analysis',
    url: 'https://youtu.be/hWM2Gw36FlU',
  },
  {
    id: 'adv-chart-patterns',
    title: 'Course 3 (Advanced): Chart Patterns',
    url: 'https://www.youtube.com/@Wysetrade/videos?view=0&sort=p&shelf_id=1',
  },
  {
    id: 'adv-cpr',
    title: 'Course 3 (Advanced): CPR',
    url: 'https://www.youtube.com/@cprbykgs/videos',
  },
  {
    id: 'adv-smc',
    title: 'Course 3 (Advanced): SMC (Smart Money Concepts)',
    url: 'https://www.youtube.com/watch?v=1NQ5U9CHL-4&list=PLb0LJvd0db_AJdPEatHGMKuuSgQyi1G2-',
  },
  {
    id: 'adv-order-block',
    title: 'Course 3 (Advanced): Order Block',
    url: 'https://www.youtube.com/watch?v=f18gazn0nYE&t=53s&pp=ygUTb3JkZXIgYmxvY2tzIGNvdXJzZdIHCQnUCgGHKiGM7w%3D%3D',
  },
  {
    id: 'adv-order-flow-strategy',
    title: 'Course 3 (Advanced): Order Flow Strategy',
    url: 'https://www.youtube.com/watch?v=Rqu-AoD9BUo&pp=ygUTb3JkZXIgZmxvdyB0cmFkaW5nINIHCQkDCwGHKiGM7w%3D%3D',
  },
  {
    id: 'adv-squeeze-momentum-1',
    title: 'Course 3 (Advanced): Squeeze Momentum (Part 1)',
    url: 'https://www.youtube.com/watch?v=Xz3l0OSvrVE&pp=ygUjc3F1ZWV6ZSBtb21lbnR1bSBpbmRpY2F0b3IgbGF6eWJlYXI%3D',
  },
  {
    id: 'adv-squeeze-momentum-2',
    title: 'Course 3 (Advanced): Squeeze Momentum (Part 2)',
    url: 'https://www.youtube.com/watch?v=fgtfI5eAS_Y&pp=ygUjc3F1ZWV6ZSBtb21lbnR1bSBpbmRpY2F0b3IgbGF6eWJlYXI%3D',
  },
  {
    id: 'adv-fibonacci',
    title: 'Course 3 (Advanced): Fibonacci Retracement and Extension',
    url: 'https://www.youtube.com/watch?v=oVMeymdZwWI&pp=ygUjZmlib25hY2NpIHJldHJhY2VtZW50IGFuZCBleHRlbnNpb24%3D',
  },
  {
    id: 'chapter3-di-plus-di-minus',
    title: 'Chapter 3: DI Plus / DI Minus Indicator',
    url: 'https://www.youtube.com/watch?v=2Ti2QTLH08Y&pp=ygUaZGkgcGx1cyBkaSBtaW51cyBpbmRpY2F0b3LSBwkJCgsBhyohjO8%3D',
  },
  {
    id: 'chapter3-adx-di',
    title: 'Chapter 3: ADX DI',
    url: 'https://youtu.be/O0I1XMgVDg8',
  },
  {
    id: 'market-profile',
    title: 'Course 4 (Advanced): Market Profile',
    url: 'https://www.youtube.com/watch?v=z-ae7tLVdoo&list=PL9myHLrE5hrMetuIrDc8FmYGW58BgofEy',
  },
];

export function resolveOnboardingCourses(envLinks = '') {
  const envCourses = String(envLinks || '')
    .split(',')
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .map((url, idx) => ({ id: `env-${idx + 1}`, title: `Course ${idx + 1}`, url }));
  return envCourses.length ? envCourses : defaultOnboardingCourses;
}

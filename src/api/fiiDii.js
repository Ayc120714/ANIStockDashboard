import { apiGet } from './apiClient';

export async function fetchFiiDiiActivity() {
  return apiGet('/fii-dii/');
}

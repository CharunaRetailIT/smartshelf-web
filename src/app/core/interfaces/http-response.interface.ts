export interface HttpResponseData<T> {
  result: T;
  results: T[] | null;
  responsCode: number;
  error: string | null;
  documentNo: string | null;
  customerCode: string | null;
  currentBalance: number;
  mobileNo: string | null;
  success: boolean;
  message: string;
}

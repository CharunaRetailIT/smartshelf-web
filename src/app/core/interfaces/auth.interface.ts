export interface User {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId: string;
  profileImageUrl?: string;
  roles: string[];
}
export interface LoginRequest {
  userName: string;
  password: string;
}
export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string;
  department?: number;
  address1?: string;
  address2?: string;
  address3?: string;
  password: string;
}
export interface LoginApiResponse {
  result: LoginResponse;
  results: any | null;
  responsCode: number;
  error: any | null;
  documentNo: any | null;
  customerCode: any | null;
  currentBalance: number;
  mobileNo: string | null;
  success: boolean;
  message: string;
}
export interface LoginResponse {
  token: string;
  user: User;
}
export interface JwtPayload {
  id: string;
  employeeId: string;
  role: string;
  exp: number;
  iat: number;
}
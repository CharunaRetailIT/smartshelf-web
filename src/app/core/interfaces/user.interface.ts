export interface User {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  roleId: number;
  role: 'Admin' | 'Manager' | 'Viewer' | 'Operator';
  isActive: boolean;
  departmentId: number;
  department: string | null;
  profileImagePath: string | null;
  address1: string | null;
  address2: string | null;
  address3: string | null;
  lastLogin: string | null;
  createdDate: string;
}

export interface UserFormData {
  firstName?: string;
  lastName?: string;
  employeeId?: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Viewer' | 'Operator';
  status: 'active' | 'inactive';
  password: string;
}


export interface UserData {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId: number;
  roleId: number;
  roleName?: string;
  departmentName?: string;
  address1?: string;
  address2?: string;
  address3?: string;
}

export interface Department {
  id: number;
  name: string;
}

export interface Role {
  id: number;
  name: string;
}

export interface UpdateUserDto {
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  department?: number;
}

export interface AssignRoleDto {
  userId: number;
  role: number;
}

export interface CreateUserDto {
  employeeId: string;
  roleId: number;
  password: string;
  firstName: string;
  lastName: string;
  email: string;
  department?: number;
  address1?: string;
  address2?: string;
  address3?: string;
}

export interface UpdateUserResponse {
  message: string;
  data?: any;
}

export interface UserProfile {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId: number;
  department: string;
  roleId: number;
  role: string;
  profileImageUrl: string | null;
  address1: string;
  address2: string;
  address3: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  address1?: string;
  address2?: string;
  address3?: string;
}
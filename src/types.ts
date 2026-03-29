/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Location {
  latitude: number;
  longitude: number;
  lastUpdated: Date;
}

export interface UserProfile {
  uid: string;
  name: string;
  role: 'senior' | 'caregiver';
  age?: number;
  primaryCaregiver?: string;
  emergencyPhone?: string;
  medications?: string;
  notes?: string;
  linkedSeniorId?: string; // For caregivers to link to a senior
}

export type UserRole = 'senior' | 'caregiver' | null;

export type EventOutcome = 'Completed' | 'No Response' | 'Emergency' | 'Info';

export interface ActivityLogEntry {
  id: string;
  timestamp: Date;
  agent: 'orchestrator' | 'daily_task' | 'medication' | 'chat';
  type: string;
  outcome: EventOutcome;
  message: string;
}

export interface Reminder {
  id: string;
  title: string;
  icon: string;
  time: string;
  repeat: 'Daily' | 'Weekly' | 'Monthly' | 'Once';
  agent: 'daily_task' | 'medication';
  note?: string;
  completed?: boolean;
  userId?: string;
  createdBy?: string;
  createdAt?: Date;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

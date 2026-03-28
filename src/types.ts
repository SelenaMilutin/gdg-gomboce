/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Location {
  latitude: number;
  longitude: number;
  lastUpdated: Date;
}

export interface SeniorProfile {
  name: string;
  age: number;
  primaryCaregiver: string;
  emergencyPhone: string;
  medications: string;
  notes: string;
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
  repeat: 'Once' | 'Daily' | 'Weekdays' | 'Custom';
  agent: 'daily_task' | 'medication';
  note?: string;
  completed?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

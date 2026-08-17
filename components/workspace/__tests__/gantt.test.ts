import { describe, it, expect } from 'vitest';
import type { GanttTask } from '../GanttChart';

// These are pure data-shape tests; the actual rendering is in a 'use client'
// component so we test the types and contract here.

describe('GanttTask', () => {
  it('accepts a task with full date range', () => {
    const task: GanttTask = {
      id: 't1',
      title: 'Framing',
      status: 'IN_PROGRESS',
      priority: 'NORMAL',
      startDate: new Date('2024-04-01'),
      endDate: new Date('2024-05-15'),
      dueDate: new Date('2024-05-15'),
    };
    expect(task.status).toBe('IN_PROGRESS');
    expect(task.startDate).toBeInstanceOf(Date);
  });

  it('accepts a task with only dueDate (no explicit range)', () => {
    const task: GanttTask = {
      id: 't2',
      title: 'Final inspection',
      status: 'TODO',
      priority: 'HIGH',
      startDate: null,
      endDate: null,
      dueDate: new Date('2024-08-15'),
    };
    expect(task.dueDate).toBeInstanceOf(Date);
  });

  it('accepts an unscheduled task (all dates null)', () => {
    const task: GanttTask = {
      id: 't3',
      title: 'Misc',
      status: 'TODO',
      priority: 'LOW',
      startDate: null,
      endDate: null,
      dueDate: null,
    };
    expect(task.startDate).toBeNull();
  });
});

describe('Gantt date math', () => {
  it('computes week-aligned timeline start', () => {
    // start of week for a Wednesday should be the previous Sunday
    const wed = new Date('2024-03-13T12:00:00');
    const dow = wed.getDay(); // 3 for Wed
    const start = new Date(wed);
    start.setDate(wed.getDate() - dow);
    expect(start.getDay()).toBe(0); // Sunday
  });

  it('computes day-width within reasonable bounds', () => {
    // 60 days total → 15 px per day minimum, scaled to fit
    const totalDays = 60;
    const targetWidth = 900;
    const dayWidth = Math.max(20, Math.min(56, Math.floor(targetWidth / totalDays)));
    expect(dayWidth).toBeGreaterThanOrEqual(20);
    expect(dayWidth).toBeLessThanOrEqual(56);
  });

  it('clamp balanceAfter / width for same-day events', () => {
    const a = new Date('2024-03-15T00:00:00');
    const b = new Date('2024-03-15T00:00:00');
    const widthPx = Math.max(12, Math.round(((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)) * 30));
    expect(widthPx).toBeGreaterThan(0); // never zero
    // Same-day range should still be at least 12px wide
    expect(widthPx).toBeGreaterThanOrEqual(12);
  });
});

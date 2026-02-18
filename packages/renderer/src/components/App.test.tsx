import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import App from './App';

test('renders moneymoney brand', () => {
  render(<App />);
  const linkElements = screen.getAllByText(/MoneyMoney/i);
  expect(linkElements.length).toBeGreaterThan(0);
});

import { Type } from "@google/genai";

export interface Sport {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

export interface Odd {
  name: string;
  price: number;
}

export interface Market {
  key: string;
  last_update: string;
  outcomes: Odd[];
}

export interface Bookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: Market[];
}

export interface EventOdds {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
}

export interface Bankroll {
  id: number;
  amount: number;
  initial_amount: number;
}

export interface Bet {
  id: number;
  event: string;
  market: string;
  odds: number;
  fair_odds: number;
  edge: number;
  stake: number;
  status: 'pending' | 'win' | 'loss' | 'void';
  created_at: string;
}

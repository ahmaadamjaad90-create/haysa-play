import { supabase } from './supabase';

export type Message = {
  id: number;
  sender: string;
  recipient: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export type ChatSummary = {
  user_id: string;
  public_id: number;
  name: string | null;
  avatar: string;
  last_body: string;
  last_at: string;
  last_mine: boolean;
  last_read: boolean;
  unread: number;
};

export type ChatPeer = { id: string; public_id: number; name: string | null; avatar: string };

const PAGE = 50;

export async function listChats(): Promise<ChatSummary[]> {
  const { data, error } = await supabase.rpc('my_chats');
  if (error) throw error;
  return data as ChatSummary[];
}

export async function getPeer(publicId: number): Promise<ChatPeer | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, public_id, name, avatar')
    .eq('public_id', publicId)
    .maybeSingle<ChatPeer>();
  if (error) throw error;
  return data;
}

// أحدث الرسائل أول، عشان القائمة مقلوبة (الأحدث تحت)
export async function loadMessages(me: string, other: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender.eq.${me},recipient.eq.${other}),and(sender.eq.${other},recipient.eq.${me})`)
    .order('id', { ascending: false })
    .limit(PAGE);
  if (error) throw error;
  return data as Message[];
}

export async function sendMessage(to: string, body: string): Promise<Message> {
  const { data, error } = await supabase.rpc('send_message', { to_user: to, body });
  if (error) throw error;
  return data as Message;
}

export async function markRead(from: string) {
  const { error } = await supabase.rpc('mark_read', { from_user: from });
  if (error) throw error;
}

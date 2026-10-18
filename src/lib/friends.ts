import { supabase } from './supabase';

export type Friend = {
  public_id: number;
  name: string | null;
  avatar: string;
  status: 'pending' | 'accepted';
  // true: الطلب واصلني، false: أنا بعته
  incoming: boolean;
};

export type Player = { public_id: number; name: string | null; avatar: string };

export type SendResult = 'sent' | 'accepted' | 'already_friends' | 'already_sent' | 'not_found' | 'self';

export async function listFriends(): Promise<Friend[]> {
  const { data, error } = await supabase.rpc('my_friends');
  if (error) throw error;
  return data as Friend[];
}

export async function findPlayer(publicId: number): Promise<Player | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('public_id, name, avatar')
    .eq('public_id', publicId)
    .maybeSingle<Player>();
  if (error) throw error;
  return data;
}

export async function sendRequest(publicId: number): Promise<SendResult> {
  const { data, error } = await supabase.rpc('send_friend_request', { target_public_id: publicId });
  if (error) throw error;
  return data as SendResult;
}

export async function respondRequest(publicId: number, accept: boolean) {
  const { error } = await supabase.rpc('respond_friend_request', {
    other_public_id: publicId,
    accept,
  });
  if (error) throw error;
}

export async function removeFriend(publicId: number) {
  const { error } = await supabase.rpc('remove_friend', { other_public_id: publicId });
  if (error) throw error;
}

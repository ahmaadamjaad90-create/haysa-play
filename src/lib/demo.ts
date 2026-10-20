// بيانات تجريبية للعرض لحد ما نربط Supabase و LiveKit
export type DemoRoom = {
  id: string;
  name: string;
  meta: string;
  icon: 'heart' | 'hat' | 'mic';
  color: string;
  faces: { letter: string; color: string }[];
  more: number;
};

export const demoRooms: DemoRoom[] = [
  {
    id: '1',
    name: 'سهرة لودو',
    meta: 'لودو · 4 على المايك',
    icon: 'heart',
    color: '#6A35C9',
    faces: [
      { letter: 'ن', color: '#FFC93C' },
      { letter: 'م', color: '#D9381E' },
    ],
    more: 9,
  },
  {
    id: '2',
    name: 'مين الجاسوس؟',
    meta: 'الجاسوس · 8 لاعبين',
    icon: 'hat',
    color: '#D9381E',
    faces: [
      { letter: 'س', color: '#FFC93C' },
      { letter: 'ه', color: '#B4297A' },
    ],
    more: 5,
  },
  {
    id: '3',
    name: 'سوالف الشلة',
    meta: 'غرفة سوالف · 6 على المايك',
    icon: 'mic',
    color: '#B4297A',
    faces: [
      { letter: 'ر', color: '#FFC93C' },
      { letter: 'ك', color: '#6A35C9' },
    ],
    more: 3,
  },
];

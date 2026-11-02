// Team members shown on the closing page. Replace the placeholders with real data.
// `avatar` (optional): path of an image placed in /public/team/, e.g. '/team/an.jpg'.

export interface Member {
  name: string;
  initials: string;
  role: string;
  tasks: string;
  accent: 'green' | 'ha-nhi' | 'pa-then' | 'ede' | 'brown' | 'green-dark';
  avatar?: string;
}

export const team: Member[] = [
  { name: 'Họ và tên', initials: 'TN', role: 'Trưởng nhóm', tasks: 'Điều phối, duyệt nội dung cuối', accent: 'green' },
  { name: 'Họ và tên', initials: 'HN', role: 'Biên soạn · Hà Nhì', tasks: 'Nghiên cứu, viết 9 chuyên mục', accent: 'ha-nhi' },
  { name: 'Họ và tên', initials: 'PT', role: 'Biên soạn · Pà Thẻn', tasks: 'Nghiên cứu, viết 9 chuyên mục', accent: 'pa-then' },
  { name: 'Họ và tên', initials: 'ĐE', role: 'Biên soạn · Ê Đê', tasks: 'Nghiên cứu, viết 9 chuyên mục', accent: 'ede' },
  { name: 'Họ và tên', initials: 'TK', role: 'Thiết kế & minh họa', tasks: 'Giao diện, tranh màu nước', accent: 'brown' },
  { name: 'Họ và tên', initials: 'LT', role: 'Lập trình', tasks: 'Dựng website, chatbox AI', accent: 'green-dark' },
];

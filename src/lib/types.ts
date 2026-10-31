export type PhoneKind = 'cell' | 'work' | 'home' | 'fax' | 'voice';

export interface PhoneNumber {
  number: string;
  kind: PhoneKind;
}

export interface ContactFields {
  name: string;
  title: string;
  company: string;
  phones: PhoneNumber[];
  email: string;
  website: string;
  address: string;
  notes: string;
}

export interface SavedCard {
  id: string;
  createdAt: number;
  updatedAt: number;
  photo: Blob;
  fields: ContactFields;
}

export function emptyFields(): ContactFields {
  return {
    name: '',
    title: '',
    company: '',
    phones: [{ number: '', kind: 'voice' }],
    email: '',
    website: '',
    address: '',
    notes: '',
  };
}

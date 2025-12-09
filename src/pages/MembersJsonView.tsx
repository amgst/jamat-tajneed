import React, { useEffect, useState } from 'react';

type Member = {
  id: string;
  name: string;
  fatherName?: string;
  gender?: string;
  cnic?: string;
  dateOfBirth?: string;
  age?: number;
  phone?: string;
  address?: string;
  tanzeem?: string;
  halqa?: string;
  profilePhoto?: string;
  createdAt?: string;
  updatedAt?: string;
};

const MembersJsonView: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch('/data/members.json')
      .then((res) => res.json())
      .then((data) => {
        setMembers(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        alert('Failed to load members.json');
      });
  }, []);

  if (loading) return <div>Loading members...</div>;

  return (
    <div style={{ padding: 24 }}>
      <h2>All Members (from public/data/members.json)</h2>
      {members.length === 0 ? (
        <div>No members found.</div>
      ) : (
        <table border={1} cellPadding={5}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Father Name</th>
              <th>Gender</th>
              <th>Age</th>
              <th>Tanzeem</th>
              <th>Phone</th>
              <th>Address</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.fatherName}</td>
                <td>{m.gender}</td>
                <td>{m.age}</td>
                <td>{m.tanzeem}</td>
                <td>{m.phone}</td>
                <td>{m.address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default MembersJsonView;

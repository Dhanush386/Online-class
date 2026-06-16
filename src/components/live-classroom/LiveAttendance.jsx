import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Download, FileText, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function LiveAttendance({ videoId, isOrganizer, videoTitle }) {
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOrganizer) return;
        fetchAttendance();
    }, [videoId, isOrganizer]);

    async function fetchAttendance() {
        const { data, error } = await supabase
            .from('live_attendance')
            .select('*, users(name, email)')
            .eq('video_id', videoId)
            .order('joined_at', { ascending: true });

        if (!error && data) {
            setAttendance(data);
        }
        setLoading(false);
    }

    const handleStatusUpdate = async (recordId, newStatus) => {
        const { error } = await supabase
            .from('live_attendance')
            .update({ attendance_status: newStatus })
            .eq('id', recordId);
        
        if (!error) {
            setAttendance(prev => prev.map(a => a.id === recordId ? { ...a, attendance_status: newStatus } : a));
        }
    };

    const downloadCSV = () => {
        const headers = ["Name", "Email", "Joined At", "Left At", "Duration (mins)", "Status"];
        const rows = attendance.map(record => [
            record.users?.name || 'Unknown',
            record.users?.email || 'Unknown',
            new Date(record.joined_at).toLocaleTimeString(),
            record.left_at ? new Date(record.left_at).toLocaleTimeString() : 'Ongoing',
            Math.round(record.duration_seconds / 60),
            record.attendance_status
        ]);

        const csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n" 
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Attendance_${videoTitle}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadPDF = () => {
        const doc = new jsPDF();
        
        doc.setFontSize(22);
        doc.setTextColor(99, 102, 241);
        doc.text(`LEARNOVA LMS`, 14, 20);
        
        doc.setFontSize(16);
        doc.setTextColor(20, 20, 20);
        doc.text(`Attendance Report`, 14, 30);
        
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Course: ${videoTitle}`, 14, 40);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 46);
        
        const presentCount = attendance.filter(a => a.attendance_status === 'present').length;
        doc.text(`Total Students: ${attendance.length} | Present: ${presentCount} | Absent: ${attendance.length - presentCount}`, 14, 52);

        const tableColumn = ["Name", "Email", "Joined", "Duration", "Status"];
        const tableRows = [];

        attendance.forEach(record => {
            const rowData = [
                record.users?.name || 'Unknown',
                record.users?.email || 'Unknown',
                new Date(record.joined_at).toLocaleTimeString(),
                `${Math.round(record.duration_seconds / 60)} mins`,
                record.attendance_status
            ];
            tableRows.push(rowData);
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 60,
            theme: 'grid',
            styles: { fontSize: 9 },
            headStyles: { fillColor: [99, 102, 241] }
        });

        doc.save(`Attendance_${videoTitle}.pdf`);
    };

    if (!isOrganizer) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Only the instructor can view the attendance report.
            </div>
        );
    }

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin text-slate-500" /></div>;

    const presentCount = attendance.filter(a => a.attendance_status === 'present').length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>Live Attendance</h3>
                <button onClick={fetchAttendance} style={{ background: 'transparent', color: '#6366f1', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>Refresh</button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <button onClick={downloadCSV} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--text-primary)', border: '1px solid var(--card-border)', color: 'white', padding: '0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <FileSpreadsheet size={16} color="#10b981" /> CSV
                </button>
                <button onClick={downloadPDF} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--text-primary)', border: '1px solid var(--card-border)', color: 'white', padding: '0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <FileText size={16} color="#ef4444" /> PDF
                </button>
            </div>

            <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Students</p>
                <p style={{ margin: 0, color: 'white', fontSize: '1.5rem', fontWeight: 'bold' }}>{attendance.length}</p>
                <p style={{ margin: 0, color: '#10b981', fontSize: '0.8rem', marginTop: '0.2rem' }}>{presentCount} Marked Present (&gt;5 mins)</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {attendance.map(record => (
                    <div key={record.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ margin: 0, color: 'white', fontSize: '0.9rem', fontWeight: 500 }}>{record.users?.name || 'Unknown'}</p>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem' }}>{Math.round(record.duration_seconds / 60)} mins</p>
                        </div>
                        <div>
                            <select 
                                value={record.attendance_status}
                                onChange={(e) => handleStatusUpdate(record.id, e.target.value)}
                                style={{
                                    padding: '0.2rem 0.5rem', 
                                    background: record.attendance_status === 'present' ? 'rgba(16, 185, 129, 0.2)' : 
                                                record.attendance_status === 'absent' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)', 
                                    color: record.attendance_status === 'present' ? '#10b981' : 
                                           record.attendance_status === 'absent' ? '#ef4444' : '#f59e0b', 
                                    border: 'none',
                                    borderRadius: '12px', 
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    WebkitAppearance: 'none',
                                    textAlign: 'center'
                                }}
                            >
                                <option value="present">Present</option>
                                <option value="absent">Absent</option>
                                <option value="insufficient_time">Insufficient</option>
                            </select>
                        </div>
                    </div>
                ))}
                {attendance.length === 0 && (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No one has joined yet.</p>
                )}
            </div>
        </div>
    );
}

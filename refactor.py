import sys

file_path = r'c:\Users\Dhanush\Downloads\Online-class-main\Online-class-main\src\pages\organizer\CodingManagement.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

def find_line_with(prefix):
    for i, line in enumerate(lines):
        if prefix in line:
            return i
    return -1

access_start = find_line_with('{/* Access Control Modal */}')
modal_start = find_line_with('{/* Modal */}')
ai_start = find_line_with('{/* AI Generation Modal */}')
sub_start = find_line_with('{/* View Submissions Modal */}')
proc_start = find_line_with('viewingReportSession && (')

return_idx = find_line_with('return (')

access_code = ''.join(lines[access_start:modal_start])
modal_code = ''.join(lines[modal_start:ai_start])
ai_code = ''.join(lines[ai_start:sub_start])
sub_code = ''.join(lines[sub_start:proc_start])

proc_end = len(lines)
for i in range(proc_start, len(lines)):
    if '</div>' in lines[i]:
        proc_end = i + 1
        break
proc_code = ''.join(lines[proc_start:proc_end])

new_functions = """
    const renderAccessControlModal = () => {
        return (
            <>
""" + access_code.rstrip() + """
            </>
        );
    };

    const renderChallengeModal = () => {
        return (
            <>
""" + modal_code.rstrip() + """
            </>
        );
    };

    const renderAIModal = () => {
        return (
            <>
""" + ai_code.rstrip() + """
            </>
        );
    };

    const renderSubmissionsModal = () => {
        return (
            <>
""" + sub_code.rstrip() + """
            </>
        );
    };

    const renderProctoringModal = () => {
        return (
            <>
                {""" + proc_code.rstrip() + """}
            </>
        );
    };
"""

middle_part = ''.join(lines[return_idx+2:access_start])

new_return = """
    return (
        <div className="animate-fade-in">
""" + middle_part + """
            {renderAccessControlModal()}
            {renderChallengeModal()}
            {renderAIModal()}
            {renderSubmissionsModal()}
            {renderProctoringModal()}
        </div>
    )
}
"""

final_code = ''.join(lines[:return_idx]) + new_functions + new_return

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(final_code)
print('Refactoring complete')

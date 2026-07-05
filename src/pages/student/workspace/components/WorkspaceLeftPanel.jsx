import PropTypes from 'prop-types'
import { FileText, HelpCircle, MessageSquare, CheckCircle2, Lock, XCircle, Info, Code as CodeIcon } from 'lucide-react'
import CodingDiscussions from '../../../../components/CodingDiscussions'

export function WorkspaceLeftPanel({
    leftTab,
    setLeftTab,
    isCombined,
    challenge,
    currentQuestion,
    solvedSubIds,
    handleSwitchSubQuestion,
    currentSubIndex,
    hasRequestedHelp,
    setHasRequestedHelp,
    hasUnlockedAnswer,
    challengeId,
    htmlCode,
    cssCode,
    jsCode,
    genericCode,
    referenceIframeUrl,
    flatWebTcs,
    currentTestCases,
    result
}) {
    const renderTestCases = () => {
        const effectiveTcs = flatWebTcs || currentTestCases
        const cases = result?.testResults || effectiveTcs
        const total = cases?.length || 0
        const hasResults = !!(result?.testResults?.length)
        const passedCount = hasResults ? cases.filter(t => t.passed).length : 0
        const failedCount = hasResults ? total - passedCount : 0
        return (
            <>
            <div style={{ display: 'flex', gap: '0.85rem', marginBottom: '1.5rem' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <CodeIcon size={14} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total</span>
                    <span style={{ marginLeft: 'auto', fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{total}</span>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: 8, border: '1px solid #05966930', background: '#05966910' }}>
                    <CheckCircle2 size={14} color="#10b981" />
                    <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>Passed</span>
                    <span style={{ marginLeft: 'auto', fontSize: '1rem', fontWeight: 800, color: '#10b981' }}>{hasResults ? passedCount : '-'}</span>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: 8, border: '1px solid #ef444430', background: '#ef444410' }}>
                    <XCircle size={14} color="#ef4444" />
                    <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>Failed</span>
                    <span style={{ marginLeft: 'auto', fontSize: '1rem', fontWeight: 800, color: '#ef4444' }}>{hasResults ? failedCount : '-'}</span>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {cases?.map((tc, idx) => {
                    const getTestCaseDisplayContent = (tcData, tc, passed, isWebTc, typeLabel, typeColor, idx) => {
                        let textColor = 'var(--text-muted)';
                        if (passed === true) textColor = '#059669';
                        else if (passed === false) textColor = '#dc2626';

                        if (tcData.is_hidden) {
                            return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: textColor }}>
                                    <Lock size={14} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Hidden Test Case</span>
                                </div>
                            );
                        }
                        if (tcData.description || isWebTc) {
                            return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {typeLabel && (
                                        <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '0.1rem 0.4rem', background: typeColor, color: typeColor === '#f59e0b' ? '#000' : '#fff', borderRadius: 4, flexShrink: 0 }}>{typeLabel}</span>
                                    )}
                                    <span style={{ fontSize: '0.85rem', color: textColor, lineHeight: 1.5, fontWeight: 500 }}>{tcData.description || tc.description}</span>
                                </div>
                            );
                        }
                        if (tcData.input || tcData.expected_output) {
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', padding: '0.5rem 0' }}>
                                    {tcData.input && (
                                        <div>
                                            <h5 style={{ margin: '0 0 0.85rem 0', fontSize: '1rem', fontWeight: 400, color: 'var(--text-primary)' }}>Sample Input {idx + 1}</h5>
                                            <div style={{ background: '#f4f6fc', padding: '1rem', borderRadius: 6, fontSize: '0.9rem', color: 'var(--text-primary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{tcData.input}</div>
                                        </div>
                                    )}
                                    {tcData.expected_output && (
                                        <div>
                                            <h5 style={{ margin: '0 0 0.85rem 0', fontSize: '1rem', fontWeight: 400, color: 'var(--text-primary)' }}>Sample Output {idx + 1}</h5>
                                            <div style={{ background: '#f4f6fc', padding: '1rem', borderRadius: 6, fontSize: '0.9rem', color: 'var(--text-primary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{tcData.expected_output}</div>
                                        </div>
                                    )}
                                </div>
                            );
                        }
                        return <span style={{ fontSize: '0.85rem', color: textColor, lineHeight: 1.5, fontWeight: 500 }}>Test Case {idx + 1}</span>;
                    };

                    const renderTestCaseCard = (tc, idx) => {
                        const tcData = effectiveTcs?.[idx] || tc;
                        const passed = hasResults ? tc.passed : null;
                        const isWebTc = !!(tc.type || tcData._wtype);
                        const wtype = tc.type || tcData._wtype;
                        
                        let typeColor = '#f59e0b';
                        if (wtype === 'html') typeColor = '#ef4444';
                        else if (wtype === 'css') typeColor = '#3b82f6';
                
                        const typeLabel = wtype ? wtype.toUpperCase() : null;
                        const displayContent = getTestCaseDisplayContent(tcData, tc, passed, isWebTc, typeLabel, typeColor, idx);
                
                        let statusColor = '#cbd5e1';
                        let StatusIcon = Info;
                        let iconColor = 'var(--text-secondary)';

                        if (passed === true) {
                            statusColor = '#10b981';
                            StatusIcon = CheckCircle2;
                            iconColor = '#10b981';
                        } else if (passed === false) {
                            statusColor = '#ef4444';
                            StatusIcon = XCircle;
                            iconColor = '#ef4444';
                        }
                
                        return (
                            <div key={tcData.id || tc.id || `tc-${idx}`} style={{ padding: '1rem 1.25rem', borderRadius: 8, background: '#f8fafc', borderLeft: `3px solid ${statusColor}`, transition: 'all 0.2s ease' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                                    <StatusIcon size={18} color={iconColor} style={{ marginTop: 2, flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>{displayContent}</div>
                                </div>
                                {/* Web testcase: Expected vs Found detail */}
                                {hasResults && isWebTc && (
                                    <div style={{ marginLeft: '2.2rem', marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', width: 56 }}>Expected</span>
                                            <code style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', background: '#ecfdf5', color: '#059669', borderRadius: 4, border: '1px solid #d1fae5' }}>{tc.expected}</code>
                                        </div>
                                        {!tc.passed && (
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', width: 56 }}>Found</span>
                                                <code style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', background: '#fef2f2', color: '#dc2626', borderRadius: 4, border: '1px solid #fecaca' }}>{tc.actual}</code>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {/* Classic testcase: stdout output */}
                                {hasResults && !isWebTc && tc.actual && (
                                    <div style={{ marginLeft: '2.2rem', marginTop: '0.85rem' }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Your Output:</span>
                                        <pre style={{ background: '#f1f5f9', padding: '0.5rem 0.85rem', borderRadius: 6, marginTop: '0.25rem', fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-primary)' }}>{tc.actual}</pre>
                                    </div>
                                )}
                            </div>
                        );
                    };

                    return renderTestCaseCard(tc, idx);
                })}
            </div>
            </>
        )
    }

    const renderDescriptionTab = () => (
        <div className="animate-fade-in">
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>{isCombined ? `${challenge.title} - ${currentQuestion.title}` : challenge.title}</h1>
            {isCombined && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem', background: '#f8fafc', padding: '0.5rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    {challenge.test_cases.sub_questions.map((q, idx) => {
                        const isSolved = solvedSubIds.includes(q.id);

                        let bgColor = '#ffffff';
                        let bdColor = '#cbd5e1';
                        if (currentSubIndex === idx) {
                            bgColor = '#3b82f6';
                            bdColor = '#2563eb';
                        } else if (isSolved) {
                            bgColor = '#10b981';
                            bdColor = '#059669';
                        }

                        return (
                            <button 
                                key={q.id} 
                                onClick={() => handleSwitchSubQuestion(idx)}
                                style={{ 
                                    padding: '0.4rem 0.85rem', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600, border: '1px solid', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                                    background: bgColor,
                                    color: currentSubIndex === idx || isSolved ? '#ffffff' : 'var(--text-muted)',
                                    borderColor: bdColor
                                }}
                            >
                                {isSolved && <CheckCircle2 size={12} />}
                                Part {idx + 1} ({q.xp_reward || 15} XP)
                            </button>
                        )
                    })}
                </div>
            )}
            <div style={{ fontSize: '0.9rem', color: 'var(--card-border)', lineHeight: 1.6, marginBottom: '2rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{currentQuestion.problem_statement}</div>

            {currentQuestion.input_format && (
                <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Input Format</h4>
                    <div style={{ fontSize: '0.9rem', color: 'var(--card-border)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{currentQuestion.input_format}</div>
                </div>
            )}

            {currentQuestion.output_format && (
                <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Output Format</h4>
                    <div style={{ fontSize: '0.9rem', color: 'var(--card-border)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{currentQuestion.output_format}</div>
                </div>
            )}

            {currentQuestion.constraints && (
                <div style={{ marginBottom: '2rem' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Constraints</h4>
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.9rem', color: 'var(--card-border)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                        {currentQuestion.constraints}
                    </div>
                </div>
            )}

            {challenge.target_visual_url && (
                <div style={{ marginBottom: '2rem' }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.85rem', color: '#3b82f6' }}>Refer to the below image.</p>
                    <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f1f5f9' }}>
                        <img src={challenge.target_visual_url} alt="Goal" style={{ width: '100%', display: 'block' }} />
                    </div>
                </div>
            )}

            {/* ── Reference iFrame (HTML challenges only) ── */}
            {referenceIframeUrl?.startsWith('https://') && (
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                        <div style={{ width: 20, height: 20, background: '#3b82f6', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: 'white', fontSize: '0.55rem', fontWeight: 800 }}>{'<>'}</span>
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e40af' }}>Reference Demo</span>
                        <a
                            href={referenceIframeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ marginLeft: 'auto', fontSize: '0.68rem', color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}
                        >
                            Open ↗
                        </a>
                    </div>
                    <div style={{ borderRadius: 8, overflow: 'hidden', border: '2px solid #bfdbfe', background: '#f1f5f9', height: 220 }}>
                        <iframe
                            src={referenceIframeUrl}
                            title="Reference Demo"
                            sandbox="allow-scripts allow-same-origin allow-forms"
                            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                            loading="lazy"
                        />
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>This is the reference page your output should resemble.</p>
                </div>
            )}

            {/* Testcases Section */}
            <div style={{ marginTop: '2.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>Testcases</h4>
                {renderTestCases()}
            </div>
        </div>
    )

    const renderDiscussTab = () => (
        <CodingDiscussions challengeId={challengeId} currentCode={challenge?.language === 'html' ? {html: htmlCode, css: cssCode, js: jsCode} : genericCode} />
    )

    const renderHelpTab = () => (
        <div style={{ color: 'var(--card-border)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            {hasRequestedHelp ? (
                <div className="animate-fade-in">
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Help & Hints</h3>
                    <p style={{ marginBottom: '1rem' }}>Review the problem constraints and testcases carefully. Often, missing edge cases is the reason for failure.</p>
                    
                    {hasUnlockedAnswer ? (
                        <div style={{ marginTop: '2rem', padding: '1rem', background: '#d1fae5', border: '1px solid #10b981', borderRadius: 8 }}>
                            <h4 style={{ color: '#10b981', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={16} /> Solution Unlocked</h4>
                            <pre style={{ background: '#ecfdf5', padding: '1rem', borderRadius: 6, color: '#064e3b', overflowX: 'auto', fontSize: '0.8rem' }}>
                                {(isCombined ? currentQuestion.solution_code : challenge.solution_code) || "No solution provided by organizer."}
                            </pre>
                            <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#6ee7b7' }}>You will not receive XP for this challenge.</p>
                        </div>
                    ) : (
                        <div style={{ marginTop: '2rem', padding: '1rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>If you are still stuck when the timer expires, you will have the option to unlock the correct answer. Note that unlocking the answer forfeits XP for this challenge.</p>
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ textAlign: 'center', marginTop: '3rem' }}>
                    <HelpCircle size={40} style={{ margin: '0 auto 1rem', opacity: 0.5, color: 'var(--text-muted)' }} />
                    <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>Stuck on this problem? You can request help to see hints.</p>
                    <button onClick={() => setHasRequestedHelp(true)} className="btn-primary" style={{ padding: '0.5rem 1rem' }}>Get Help</button>
                </div>
            )}
        </div>
    )

    return (
        <div style={{ width: '28%', minWidth: 320, background: '#ffffff', borderRadius: 8, display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0' }}>
            <div style={{ height: 40, borderBottom: '1px solid #e2e8f0', display: 'flex', padding: '0 4px' }}>
                <button onClick={() => setLeftTab('description')} style={{ flex: 1, background: 'none', border: 'none', color: leftTab === 'description' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', borderBottom: leftTab === 'description' ? '2px solid #3b82f6' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <FileText size={14} /> Description
                </button>
                <button onClick={() => setLeftTab('help')} style={{ flex: 1, background: 'none', border: 'none', color: leftTab === 'help' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', borderBottom: leftTab === 'help' ? '2px solid #3b82f6' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <HelpCircle size={14} /> Get Help
                </button>
                <button onClick={() => setLeftTab('discuss')} style={{ flex: 1, background: 'none', border: 'none', color: leftTab === 'discuss' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', borderBottom: leftTab === 'discuss' ? '2px solid #3b82f6' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <MessageSquare size={14} /> Discuss
                </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                {leftTab === 'description' && renderDescriptionTab()}
                {leftTab === 'discuss' && renderDiscussTab()}
                {leftTab === 'help' && renderHelpTab()}
            </div>
        </div>
    )
}

WorkspaceLeftPanel.propTypes = {
    leftTab: PropTypes.string,
    setLeftTab: PropTypes.func,
    isCombined: PropTypes.bool,
    challenge: PropTypes.shape({
        title: PropTypes.string,
        test_cases: PropTypes.shape({
            sub_questions: PropTypes.arrayOf(PropTypes.any)
        }),
        target_visual_url: PropTypes.string,
        language: PropTypes.string,
        solution_code: PropTypes.string
    }),
    currentQuestion: PropTypes.shape({
        title: PropTypes.string,
        problem_statement: PropTypes.string,
        input_format: PropTypes.string,
        output_format: PropTypes.string,
        constraints: PropTypes.string,
        solution_code: PropTypes.string
    }),
    solvedSubIds: PropTypes.arrayOf(PropTypes.any),
    handleSwitchSubQuestion: PropTypes.func,
    currentSubIndex: PropTypes.number,
    hasRequestedHelp: PropTypes.bool,
    setHasRequestedHelp: PropTypes.func,
    hasUnlockedAnswer: PropTypes.bool,
    challengeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    htmlCode: PropTypes.string,
    cssCode: PropTypes.string,
    jsCode: PropTypes.string,
    genericCode: PropTypes.string,
    referenceIframeUrl: PropTypes.string,
    flatWebTcs: PropTypes.array,
    currentTestCases: PropTypes.array,
    result: PropTypes.shape({
        testResults: PropTypes.arrayOf(PropTypes.any)
    })
}

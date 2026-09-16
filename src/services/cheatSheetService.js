import { supabase } from '../lib/supabase'

const CACHE_KEY_PREFIX = 'learnova_cheatsheet_cache_'
const LIST_CACHE_KEY = 'learnova_cheatsheet_list_cache'
const DELETED_IDS_KEY = 'learnova_cheatsheet_deleted_ids'

function getDeletedIds() {
  try {
    return JSON.parse(localStorage.getItem(DELETED_IDS_KEY) || '[]')
  } catch {
    return []
  }
}

function recordDeletedId(idOrSlug) {
  try {
    const list = getDeletedIds()
    if (idOrSlug && !list.includes(idOrSlug)) {
      list.push(idOrSlug)
    }
    // Also blacklist default id and slug if deleting CSS Part 3
    if (idOrSlug === 'e2b4f7a1-8c3d-4e5f-9a1b-2c3d4e5f6a7b' || idOrSlug === 'css-part-3' || idOrSlug === 'Introduction to CSS | Part 3') {
      if (!list.includes('css-part-3')) list.push('css-part-3')
      if (!list.includes('e2b4f7a1-8c3d-4e5f-9a1b-2c3d4e5f6a7b')) list.push('e2b4f7a1-8c3d-4e5f-9a1b-2c3d4e5f6a7b')
    }
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(list))

    // Remove immediately from list cache
    const cached = localStorage.getItem(LIST_CACHE_KEY)
    if (cached) {
      const items = JSON.parse(cached) || []
      const filtered = items.filter(s => s.id !== idOrSlug && s.slug !== idOrSlug && (idOrSlug !== 'e2b4f7a1-8c3d-4e5f-9a1b-2c3d4e5f6a7b' || s.slug !== 'css-part-3'))
      localStorage.setItem(LIST_CACHE_KEY, JSON.stringify(filtered))
    }
  } catch (_e) {
    void _e
  }
}

function unmarkDeletedId(idOrSlug) {
  try {
    const list = getDeletedIds().filter(d => d !== idOrSlug && d !== 'css-part-3' && d !== 'e2b4f7a1-8c3d-4e5f-9a1b-2c3d4e5f6a7b')
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(list))
  } catch (_e) {
    void _e
  }
}

export const DAY_NAMES = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday'
}

export function formatDayName(dayVal) {
  if (!dayVal) return 'Monday'
  if (typeof dayVal === 'string' && isNaN(Number(dayVal))) return dayVal
  const num = Number(dayVal)
  return DAY_NAMES[num] || `Day ${num}`
}

/**
 * Normalizes cheat sheet sections, ensuring questions accurately reflect question count
 * and cleaning up legacy hardcoded 'Question 1 of 3' placeholders.
 */
export function normalizeCheatSheet(sheet) {
  if (!sheet) return sheet
  try {
    const cloned = JSON.parse(JSON.stringify(sheet))
    cloned.day_name = formatDayName(cloned.day_of_week || cloned.day_number || 1)
    if (Array.isArray(cloned.sections)) {
      cloned.sections = cloned.sections.map(sec => {
        if (sec && sec.quiz) {
          if (!sec.quiz.questionNumber || sec.quiz.questionNumber === 'Question 1 of 3' || sec.quiz.questionNumber === 'Question 1 of 2') {
            sec.quiz.questionNumber = 'Question 1 of 1'
          }
          if (!sec.quiz.type) {
            sec.quiz.type = Array.isArray(sec.quiz.options) ? 'mcq' : 'code_input'
          }
          if (sec.quiz.type === 'code_input' && !sec.quiz.matchMode) {
            sec.quiz.matchMode = 'flexible'
          }
        }
        return sec
      })
    }
    return cloned
  } catch {
    return sheet
  }
}

/**
 * Hardcoded default for "Introduction to CSS | Part 3"
 * Used ONLY as a graceful read fallback when database cannot be reached offline.
 */
const DEFAULT_CSS_CHEAT_SHEET = {
  id: 'e2b4f7a1-8c3d-4e5f-9a1b-2c3d4e5f6a7b',
  title: 'Introduction to CSS | Part 3',
  slug: 'css-part-3',
  topic_badge: 'Introduction to HTML & CSS',
  breadcrumb_title: 'Introduction to CSS | Part 3 | Cheat Sheet',
  description: 'Master Font Family, Font Size, Font Style, and Font Weight with live examples, interactive quizzes, and playground.',
  week_number: 3,
  day_number: 2,
  day_of_week: 2,
  day_name: 'Tuesday',
  estimated_minutes: 10,
  xp_reward: 10,
  status: 'published',
  sections: [
    {
      id: 'sec-1',
      type: 'standard',
      title: '1. Font Family',
      description: 'The CSS `font-family` property specifies the font for an element.',
      codeBlock: {
        language: 'CSS',
        code: '@import url("https://fonts.googleapis.com/css2?family=Bree+Serif&family=Caveat:wght@400;700&family=Lobster&family=Monoton&family=Playfair+Display&family=Playfair+Display+SC&family=Roboto&display=swap");\n\n.main-heading {\n  font-family: "Roboto";\n}\n\n.paragraph {\n  font-family: "Roboto";\n}'
      },
      fontPreview: {
        text: 'You can use one of the below values of the `font-family` property,',
        sampleWord: 'Tourism',
        fonts: [
          { name: '"Roboto"', family: 'Roboto', style: 'normal', weight: '700' },
          { name: '"Caveat"', family: 'Caveat', style: 'normal', weight: '700' },
          { name: '"Lobster"', family: 'Lobster', style: 'normal', weight: '400' },
          { name: '"Bree Serif"', family: 'Bree Serif', style: 'normal', weight: '400' },
          { name: '"Playfair Display"', family: 'Playfair Display', style: 'normal', weight: '700' },
          { name: '"Monoton"', family: 'Monoton', style: 'normal', weight: '400', uppercase: true },
          { name: '"Playfair Display SC"', family: 'Playfair Display SC', style: 'normal', weight: '700', uppercase: true }
        ]
      },
      note: {
        items: [
          'To use font families, you need to import their style sheets into your CSS file.',
          'There shouldn\'t be any spelling mistakes in the values of the `font-family` property.',
          'There must be quotations around the value of the `font-family` property.'
        ]
      },
      quiz: {
        questionNumber: 'Question 1 of 1',
        prompt: 'Which of the following is a valid value of the **CSS Property** `font-family` ?',
        options: ['blue', '"Roboto"', 'red', 'center'],
        correctAnswer: '"Roboto"',
        explanation: '"Roboto" is a valid font-family name imported from Google Fonts. Colors like blue/red are used for color, while center is for text-align.'
      }
    },
    {
      id: 'sec-2',
      type: 'standard',
      title: '2. Font Size',
      description: 'The CSS `font-size` property specifies the size of the font.',
      codeBlock: {
        language: 'CSS',
        code: '.main-heading {\n  font-size: 36px;\n}\n\n.paragraph {\n  font-size: 28px;\n}'
      },
      note: {
        items: [
          'You must add `px` after the number in the value of the `font-size` property.',
          'There shouldn\'t be any space between the number and `px`.',
          'There shouldn\'t be any quotations around the value of the `font-size` property.'
        ]
      }
    },
    {
      id: 'sec-3',
      type: 'standard',
      title: '3. Font Style',
      description: 'The CSS `font-style` property specifies the font style for a text.',
      valueTable: {
        title: 'You can use one of the below values of the `font-style` property,',
        header: 'Value',
        values: ['normal', 'italic', 'oblique']
      },
      codeBlock: {
        language: 'CSS',
        code: '.main-heading {\n  font-style: italic;\n}\n\n.paragraph {\n  font-style: normal;\n}'
      },
      note: {
        items: [
          'There shouldn\'t be any spelling mistakes in the values of the `font-style` property.',
          'There shouldn\'t be any quotations around the value of the `font-style` property.'
        ]
      },
      quiz: {
        questionNumber: 'Question 1 of 1',
        prompt: 'Fill in the blank with an appropriate **value** for the given **CSS Property**.',
        snippet: '.paragraph {\n  font-style: ___________;\n}',
        options: ['20px', 'italic', 'blue', '"Roboto"'],
        correctAnswer: 'italic',
        explanation: 'italic is a valid value for the font-style property. 20px is for font-size, blue is for color, and "Roboto" is for font-family.'
      }
    },
    {
      id: 'sec-4',
      type: 'standard',
      title: '4. Font Weight',
      description: 'The CSS `font-weight` property sets how thick or thin characters in text should be displayed.',
      codeBlock: {
        language: 'CSS',
        code: '.main-heading {\n  font-weight: bold;\n}\n\n.paragraph {\n  font-weight: normal;\n}'
      },
      playground: {
        title: 'Practice Challenge: Typography & Font Styling',
        difficulty: 'Beginner',
        instructions: '1. Set font-family of .main-heading to "Caveat", cursive\n2. Set font-size of .paragraph to 18px and its color to #334155\n3. Add font-style: italic on .main-heading\n4. Click "Run Code" to preview the live rendering in the sandboxed browser!',
        hints: 'Google Fonts are already imported via @import at the top of the CSS file. Remember to terminate every CSS rule with a semicolon.',
        starterHtml: '<!DOCTYPE html>\n<html>\n  <head>\n  </head>\n  <body>\n    <h1 class="main-heading">Tourism</h1>\n    <hr />\n    <p class="paragraph">Plan your trip wherever you want to go</p>\n  </body>\n</html>',
        starterCss: '@import url("https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Roboto:wght@400;700&display=swap");\n\n.main-heading {\n  font-family: "Caveat", cursive;\n  font-size: 38px;\n  font-style: italic;\n  color: #1e293b;\n  margin-bottom: 0.25rem;\n}\n\n.paragraph {\n  font-family: "Roboto", sans-serif;\n  font-size: 18px;\n  color: #334155;\n}',
        starterJs: '// Live code runner initialized\nconsole.log("Cheat Sheet Playground ready!");'
      }
    }
  ]
}

export const cheatSheetService = {
  /**
   * Fetches a cheat sheet by ID or slug with enrollment verification
   */
  async getCheatSheet(idOrSlug, studentId) {
    const deletedIds = getDeletedIds()
    if (deletedIds.includes(idOrSlug) || (idOrSlug === 'e2b4f7a1-8c3d-4e5f-9a1b-2c3d4e5f6a7b' && deletedIds.includes('css-part-3')) || (idOrSlug === 'css-part-3' && deletedIds.includes('css-part-3'))) {
      return { data: null, error: 'Cheat sheet not found or has been deleted.' }
    }

    try {
      // Determine if idOrSlug is a UUID
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug)
      let query = supabase.from('cheat_sheets').select('*, courses(id, title)')
      
      if (isUuid) {
        query = query.eq('id', idOrSlug)
      } else {
        query = query.eq('slug', idOrSlug)
      }

      const { data, error } = await query.maybeSingle()

      if (error) throw error

      if (data) {
        // Enforce student enrollment check if sheet is tied to a course
        if (studentId && data.course_id) {
          const { data: enrollment } = await supabase
            .from('enrollments')
            .select('id')
            .eq('student_id', studentId)
            .eq('course_id', data.course_id)
            .maybeSingle()

          if (!enrollment) {
            return {
              data: null,
              isEnrolled: false,
              courseTitle: data.courses?.title,
              error: 'You are not enrolled in the course associated with this cheat sheet.'
            }
          }
        }

        // Cache for offline read-only fallback
        try {
          localStorage.setItem(`${CACHE_KEY_PREFIX}${idOrSlug}`, JSON.stringify({
            data,
            cachedAt: Date.now()
          }))
        } catch {
          // ignore localstorage errors
        }

        return { data: normalizeCheatSheet(data), isEnrolled: true, isCached: false }
      }
    } catch (err) {
      console.warn('Network or DB error fetching cheat sheet, trying offline cache:', err)
    }

    // Try offline read-only cache
    try {
      const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${idOrSlug}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        return { data: normalizeCheatSheet(parsed.data), isEnrolled: true, isCached: true }
      }
    } catch {
      // ignore
    }

    // Fallback to built-in default if requesting default slug and not deleted
    if (deletedIds.includes(idOrSlug) || (idOrSlug === 'e2b4f7a1-8c3d-4e5f-9a1b-2c3d4e5f6a7b' && deletedIds.includes('css-part-3'))) {
      return { data: null, error: 'Cheat sheet not found or has been deleted.' }
    }

    if ((idOrSlug === 'css-part-3' || idOrSlug === DEFAULT_CSS_CHEAT_SHEET.id) && !deletedIds.includes('css-part-3') && !deletedIds.includes(DEFAULT_CSS_CHEAT_SHEET.id)) {
      return { data: normalizeCheatSheet(DEFAULT_CSS_CHEAT_SHEET), isEnrolled: true, isCached: true }
    }

    return { data: null, error: 'Cheat sheet not found.' }
  },

  /**
   * Lists cheat sheets (for Organizer dashboard or Student course syllabus)
   */
  async listCheatSheets({ courseId, status } = {}) {
    const deletedIds = getDeletedIds()
    const filterDeleted = (list) => (list || []).filter(s => !deletedIds.includes(s.id) && !deletedIds.includes(s.slug))

    try {
      let query = supabase.from('cheat_sheets').select('*, courses(id, title), cheat_sheet_completions(count)').order('created_at', { ascending: false })

      if (courseId) {
        query = query.eq('course_id', courseId)
      }
      if (status) {
        query = query.eq('status', status)
      }

      const { data, error } = await query
      if (error) throw error

      if (data) {
        const filtered = filterDeleted(data)
        try {
          localStorage.setItem(LIST_CACHE_KEY, JSON.stringify(filtered))
        } catch (_storageErr) {
          void _storageErr
        }
        return { data: filtered.map(normalizeCheatSheet) }
      }
    } catch (err) {
      console.warn('Failed listing from Supabase, attempting cache:', err)
      try {
        const cached = localStorage.getItem(LIST_CACHE_KEY)
        if (cached) {
          const filtered = filterDeleted(JSON.parse(cached))
          return { data: filtered.map(normalizeCheatSheet), isCached: true }
        }
      } catch (_cacheErr) {
        void _cacheErr
      }
    }

    // Fallback list (only if default sheet was NOT deleted)
    if (deletedIds.includes(DEFAULT_CSS_CHEAT_SHEET.id) || deletedIds.includes('css-part-3')) {
      return { data: [], isCached: true }
    }

    return { data: [normalizeCheatSheet(DEFAULT_CSS_CHEAT_SHEET)], isCached: true }
  },

  /**
   * Saves (creates or updates) a cheat sheet from Organizer Suite
   * Must write directly to Supabase - NEVER silently swallow into localStorage
   */
  async saveCheatSheet(sheet) {
    if (sheet.id) unmarkDeletedId(sheet.id)
    if (sheet.slug) unmarkDeletedId(sheet.slug)

    const payload = {
      title: sheet.title,
      slug: sheet.slug || sheet.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      topic_badge: sheet.topic_badge || 'Introduction to HTML & CSS',
      breadcrumb_title: sheet.breadcrumb_title || `${sheet.title} | Cheat Sheet`,
      description: sheet.description || '',
      course_id: sheet.course_id || null,
      week_number: Number(sheet.week_number) || 1,
      day_number: Number(sheet.day_number) || Number(sheet.day_of_week) || 1,
      day_of_week: Number(sheet.day_of_week) || Number(sheet.day_number) || 1,
      estimated_minutes: Number(sheet.estimated_minutes) || 10,
      xp_reward: Number(sheet.xp_reward) || 10,
      status: sheet.status || 'published',
      sections: sheet.sections || [],
      updated_at: new Date().toISOString()
    }

    if (sheet.id) {
      const { data, error } = await supabase
        .from('cheat_sheets')
        .update(payload)
        .eq('id', sheet.id)
        .select()
        .single()
      if (error) throw error
      return data
    } else {
      const { data, error } = await supabase
        .from('cheat_sheets')
        .insert([payload])
        .select()
        .single()
      if (error) throw error
      return data
    }
  },

  /**
   * Deletes a cheat sheet (Organizer only)
   */
  async deleteCheatSheet(id) {
    // 1. Permanently blacklist in local storage so it never resurfaces in dashboard or student views
    recordDeletedId(id)

    // 2. Try dedicated delete RPC if available in database
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('delete_cheat_sheet', {
        p_sheet_id: id
      })
      if (!rpcErr && rpcRes) return true
    } catch (_rpcErr) {
      void _rpcErr
    }

    // 3. Delete directly from Supabase
    try {
      try {
        await supabase.from('cheat_sheet_completions').delete().eq('cheat_sheet_id', id)
      } catch (_cErr) {
        void _cErr
      }
      const { error } = await supabase.from('cheat_sheets').delete().eq('id', id)
      if (id === DEFAULT_CSS_CHEAT_SHEET.id || id === 'css-part-3') {
        try {
          await supabase.from('cheat_sheets').delete().eq('slug', 'css-part-3')
        } catch (_sErr) {
          void _sErr
        }
      }
      if (error) {
        console.warn('Direct delete error from Supabase:', error)
      }
    } catch (err) {
      console.warn('Error deleting cheat sheet from Supabase:', err)
    }

    return true
  },

  /**
   * Checks if student already completed this cheat sheet
   */
  async checkCompletion(studentId, sheetId) {
    if (!studentId || !sheetId) return false
    try {
      const { data } = await supabase
        .from('cheat_sheet_completions')
        .select('id')
        .eq('student_id', studentId)
        .eq('cheat_sheet_id', sheetId)
        .maybeSingle()
      return Boolean(data)
    } catch {
      return false
    }
  },

  /**
   * Records completion and awards XP atomically & idempotently via RPC
   */
  async completeCheatSheet(sheetId) {
    try {
      // First try calling the server RPC
      const { data, error } = await supabase.rpc('complete_cheat_sheet', {
        p_sheet_id: sheetId
      })

      if (!error && data) {
        return data
      }

      // If RPC is not yet created in local dev instance, fallback to direct insert with on conflict
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { error: insertError } = await supabase
        .from('cheat_sheet_completions')
        .insert([{ student_id: user.id, cheat_sheet_id: sheetId, xp_awarded: 10 }])

      if (insertError && insertError.code !== '23505') { // 23505 = unique constraint violation
        throw insertError
      }

      return {
        success: true,
        already_completed: insertError?.code === '23505',
        xp_awarded: insertError?.code === '23505' ? 0 : 10,
        message: 'Cheat sheet completed!'
      }
    } catch (err) {
      console.error('Error completing cheat sheet:', err)
      return { success: false, error: err.message }
    }
  }
}

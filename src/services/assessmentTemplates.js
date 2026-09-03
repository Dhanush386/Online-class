/**
 * Curated Starter Test Questions for Assessments
 * Provides ready-to-use conceptual, code-based, and multi-choice questions
 * across SQL, Python, Full Stack / JavaScript, HTML/CSS, and DSA.
 */

export const STARTER_QUESTION_PACKS = {
  sql: [
    {
      question_text: "Which SQL clause is executed FIRST in the logical order of query execution?",
      question_type: "single_mcq",
      code_language: "sql",
      code_snippet: null,
      snippet_title: null,
      options: ["WHERE", "FROM", "SELECT", "GROUP BY"],
      correct_answer: ["FROM"]
    },
    {
      question_text: "Given the following query, what will be the output if there are duplicate emails in the customers table?",
      question_type: "code_mcq",
      code_language: "sql",
      code_snippet: "SELECT email, COUNT(*)\nFROM customers\nGROUP BY email\nHAVING COUNT(*) > 1;",
      snippet_title: "Duplicate Email Check",
      options: [
        "All customer records with their counts",
        "Only emails that appear more than once with their occurrence count",
        "An error because HAVING requires WHERE",
        "Only unique emails that appear exactly once"
      ],
      correct_answer: ["Only emails that appear more than once with their occurrence count"]
    },
    {
      question_text: "What is the fundamental difference between WHERE and HAVING in SQL?",
      question_type: "single_mcq",
      code_language: "sql",
      code_snippet: null,
      snippet_title: null,
      options: [
        "WHERE filters rows before aggregation; HAVING filters grouped rows after aggregation",
        "WHERE is only for numeric columns, while HAVING is for text columns",
        "HAVING can only be used with subqueries",
        "There is no functional difference; they are interchangeable"
      ],
      correct_answer: ["WHERE filters rows before aggregation; HAVING filters grouped rows after aggregation"]
    },
    {
      question_text: "Which type of JOIN guarantees all rows from the employees table are returned even if they have no matching department?",
      question_type: "code_mcq",
      code_language: "sql",
      code_snippet: "SELECT e.name, d.department_name\nFROM employees e\n____ JOIN departments d ON e.dept_id = d.id;",
      snippet_title: "Join Syntax Check",
      options: ["INNER", "LEFT", "CROSS", "NATURAL"],
      correct_answer: ["LEFT"]
    },
    {
      question_text: "What will be the result of evaluating `NULL = NULL` in standard ANSI SQL?",
      question_type: "single_mcq",
      code_language: "sql",
      code_snippet: null,
      snippet_title: null,
      options: ["TRUE", "FALSE", "UNKNOWN (NULL)", "Throws syntax error"],
      correct_answer: ["UNKNOWN (NULL)"]
    },
    {
      question_text: "Which ACID property guarantees that committed transactions survive system crashes and power failures?",
      question_type: "single_mcq",
      code_language: "sql",
      code_snippet: null,
      snippet_title: null,
      options: ["Atomicity", "Consistency", "Isolation", "Durability"],
      correct_answer: ["Durability"]
    }
  ],

  python: [
    {
      question_text: "What is the output of the following Python snippet?",
      question_type: "code_mcq",
      code_language: "python",
      code_snippet: "def append_to(element, target=[]):\n    target.append(element)\n    return target\n\nprint(append_to(1))\nprint(append_to(2))",
      snippet_title: "Default Mutable Arguments",
      options: [
        "[1] followed by [2]",
        "[1] followed by [1, 2]",
        "[1] followed by [2, 1]",
        "TypeError: mutable default argument"
      ],
      correct_answer: ["[1] followed by [1, 2]"]
    },
    {
      question_text: "Which of the following data structures in Python is IMMUTABLE?",
      question_type: "single_mcq",
      code_language: "python",
      code_snippet: null,
      snippet_title: null,
      options: ["List", "Dictionary", "Tuple", "Set"],
      correct_answer: ["Tuple"]
    },
    {
      question_text: "What will be the output of this dictionary comprehension?",
      question_type: "code_mcq",
      code_language: "python",
      code_snippet: "keys = ['a', 'b', 'c']\nvalues = [1, 2, 3]\nresult = {k: v * 2 for k, v in zip(keys, values)}\nprint(result['b'])",
      snippet_title: "Dict Comprehension",
      options: ["2", "4", "6", "KeyError: 'b'"],
      correct_answer: ["4"]
    },
    {
      question_text: "What keyword is used in Python to create a generator function that yields values on demand?",
      question_type: "single_mcq",
      code_language: "python",
      code_snippet: null,
      snippet_title: null,
      options: ["return", "yield", "generator", "async"],
      correct_answer: ["yield"]
    },
    {
      question_text: "What is the time complexity of looking up a key in a standard Python dictionary in the average case?",
      question_type: "single_mcq",
      code_language: "python",
      code_snippet: null,
      snippet_title: null,
      options: ["O(1)", "O(n)", "O(log n)", "O(n log n)"],
      correct_answer: ["O(1)"]
    },
    {
      question_text: "What does the `*args` and `**kwargs` syntax allow a Python function to accept?",
      question_type: "single_mcq",
      code_language: "python",
      code_snippet: null,
      snippet_title: null,
      options: [
        "An arbitrary number of positional arguments (*args) and keyword arguments (**kwargs)",
        "Only keyword arguments with default values",
        "Pointer arithmetic references to C extensions",
        "Restricts the function to only accept primitive data types"
      ],
      correct_answer: ["An arbitrary number of positional arguments (*args) and keyword arguments (**kwargs)"]
    }
  ],

  javascript: [
    {
      question_text: "What will be logged to the console in this asynchronous JavaScript snippet?",
      question_type: "code_mcq",
      code_language: "javascript",
      code_snippet: "console.log('1');\nsetTimeout(() => console.log('2'), 0);\nPromise.resolve().then(() => console.log('3'));\nconsole.log('4');",
      snippet_title: "Event Loop Order of Execution",
      options: [
        "1, 2, 3, 4",
        "1, 4, 2, 3",
        "1, 4, 3, 2",
        "3, 1, 4, 2"
      ],
      correct_answer: ["1, 4, 3, 2"]
    },
    {
      question_text: "What is the primary purpose of the `key` prop in React lists?",
      question_type: "single_mcq",
      code_language: "javascript",
      code_snippet: null,
      snippet_title: null,
      options: [
        "Styles list items with unique CSS class selectors",
        "Provides a stable identity so React diffing identifies which items changed, added, or removed without re-rendering the whole list",
        "Binds the item to browser localStorage automatically",
        "Prevents memory leaks by unmounting DOM event listeners"
      ],
      correct_answer: ["Provides a stable identity so React diffing identifies which items changed, added, or removed without re-rendering the whole list"]
    },
    {
      question_text: "What will the following JavaScript closure code output?",
      question_type: "code_mcq",
      code_language: "javascript",
      code_snippet: "function makeCounter() {\n    let count = 0;\n    return () => ++count;\n}\nconst c1 = makeCounter();\nconst c2 = makeCounter();\nc1();\nconsole.log(c1(), c2());",
      snippet_title: "Closures & Lexical Scope",
      options: ["2 1", "2 2", "1 1", "3 1"],
      correct_answer: ["2 1"]
    },
    {
      question_text: "Which React hook is specifically intended to memoize expensive computations between renders?",
      question_type: "single_mcq",
      code_language: "javascript",
      code_snippet: null,
      snippet_title: null,
      options: ["useCallback", "useMemo", "useRef", "useEffect"],
      correct_answer: ["useMemo"]
    },
    {
      question_text: "What is the key security advantage of setting `httpOnly: true` on an authentication session cookie?",
      question_type: "single_mcq",
      code_language: "javascript",
      code_snippet: null,
      snippet_title: null,
      options: [
        "Protects the cookie from being accessed by client-side JavaScript, preventing token theft via XSS attacks",
        "Automatically encrypts the payload with TLS 1.3",
        "Bypasses Cross-Origin Resource Sharing (CORS) preflight checks",
        "Prevents the cookie from being sent over HTTPS connections"
      ],
      correct_answer: ["Protects the cookie from being accessed by client-side JavaScript, preventing token theft via XSS attacks"]
    },
    {
      question_text: "What will be the output of `typeof NaN` in JavaScript?",
      question_type: "single_mcq",
      code_language: "javascript",
      code_snippet: null,
      snippet_title: null,
      options: ["\"number\"", "\"nan\"", "\"undefined\"", "\"object\""],
      correct_answer: ["\"number\""]
    }
  ]
}

/**
 * Determine best starter question pack based on assessment or course title
 */
export function getStarterQuestionsForAssessment(assessmentTitle = '', courseTitle = '') {
  const combined = `${assessmentTitle} ${courseTitle}`.toLowerCase()
  if (combined.includes('sql') || combined.includes('query') || combined.includes('db') || combined.includes('database')) {
    return STARTER_QUESTION_PACKS.sql
  }
  if (combined.includes('python') || combined.includes('django') || combined.includes('flask')) {
    return STARTER_QUESTION_PACKS.python
  }
  return STARTER_QUESTION_PACKS.javascript
}

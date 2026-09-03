-- ==============================================================================
-- LEARNNOVA: Assessment Starter Test Questions Seed Migration
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query)
-- It automatically creates assessments and populates comprehensive test questions
-- for SQL, Python, and Full Stack courses with both conceptual and code MCQs.
-- ==============================================================================

DO $$
DECLARE
    v_sql_course_id UUID;
    v_python_course_id UUID;
    v_fullstack_course_id UUID;
    v_sql_assess_id UUID;
    v_python_assess_id UUID;
    v_fullstack_assess_id UUID;
BEGIN
    -- ─────────────────────────────────────────────────────────────
    -- 1. Locate Courses by Title (with fallback to any available course)
    -- ─────────────────────────────────────────────────────────────
    SELECT id INTO v_sql_course_id FROM public.courses WHERE title ILIKE '%sql%' LIMIT 1;
    SELECT id INTO v_python_course_id FROM public.courses WHERE title ILIKE '%python%' LIMIT 1;
    SELECT id INTO v_fullstack_course_id FROM public.courses WHERE title ILIKE '%full%stack%' OR title ILIKE '%web%' LIMIT 1;

    -- Fallbacks if courses are named differently
    IF v_sql_course_id IS NULL THEN
        SELECT id INTO v_sql_course_id FROM public.courses ORDER BY created_at ASC LIMIT 1;
    END IF;
    IF v_python_course_id IS NULL THEN
        v_python_course_id := v_sql_course_id;
    END IF;
    IF v_fullstack_course_id IS NULL THEN
        v_fullstack_course_id := v_sql_course_id;
    END IF;

    -- ─────────────────────────────────────────────────────────────
    -- 2. Ensure Assessments Exist for Each Course
    -- ─────────────────────────────────────────────────────────────

    -- A. SQL Assessment
    IF v_sql_course_id IS NOT NULL THEN
        SELECT id INTO v_sql_assess_id 
        FROM public.assessments 
        WHERE course_id = v_sql_course_id AND title ILIKE '%SQL Query & Database Design%'
        LIMIT 1;

        IF v_sql_assess_id IS NULL THEN
            INSERT INTO public.assessments (
                course_id, type, title, description, duration, week_number, day_of_week
            ) VALUES (
                v_sql_course_id,
                'weekly',
                'SQL Query & Database Design Assessment',
                'Comprehensive test covering JOINS, subqueries, aggregations, indexing, and normalization.',
                30,
                1,
                5
            ) RETURNING id INTO v_sql_assess_id;
        END IF;

        -- Seed Questions for SQL
        INSERT INTO public.questions (
            assessment_id, question_text, question_type, code_language, code_snippet, snippet_title, options, correct_answer
        ) VALUES
        (
            v_sql_assess_id,
            'Which SQL clause is executed FIRST in the logical order of query execution?',
            'single_mcq',
            'sql',
            NULL,
            NULL,
            '["WHERE", "FROM", "SELECT", "GROUP BY"]'::jsonb,
            '["FROM"]'
        ),
        (
            v_sql_assess_id,
            'Given the following query, what will be the output if there are duplicate emails in the customers table?',
            'code_mcq',
            'sql',
            'SELECT email, COUNT(*)' || E'\n' ||
            'FROM customers' || E'\n' ||
            'GROUP BY email' || E'\n' ||
            'HAVING COUNT(*) > 1;',
            'Duplicate Email Query',
            '["All customer records with their counts", "Only emails that appear more than once with their occurrence count", "An error because HAVING requires WHERE", "Only unique emails that appear exactly once"]'::jsonb,
            '["Only emails that appear more than once with their occurrence count"]'
        ),
        (
            v_sql_assess_id,
            'What is the fundamental difference between WHERE and HAVING in SQL?',
            'single_mcq',
            'sql',
            NULL,
            NULL,
            '["WHERE filters rows before aggregation, while HAVING filters grouped rows after aggregation", "WHERE is only for numeric columns, HAVING is for text", "HAVING can only be used with subqueries", "There is no functional difference; they are interchangeable"]'::jsonb,
            '["WHERE filters rows before aggregation, while HAVING filters grouped rows after aggregation"]'
        ),
        (
            v_sql_assess_id,
            'Examine the SQL statement below. Which type of JOIN guarantees that all rows from the employees table will be returned even if they have no matching department?',
            'code_mcq',
            'sql',
            'SELECT e.name, d.department_name' || E'\n' ||
            'FROM employees e' || E'\n' ||
            '____ JOIN departments d ON e.dept_id = d.id;',
            'Join Syntax Check',
            '["INNER", "LEFT", "CROSS", "NATURAL"]'::jsonb,
            '["LEFT"]'
        ),
        (
            v_sql_assess_id,
            'Which of the following constraints enforces uniqueness and creates an automatic B-Tree index in PostgreSQL?',
            'single_mcq',
            'sql',
            NULL,
            NULL,
            '["NOT NULL", "CHECK", "PRIMARY KEY", "FOREIGN KEY"]'::jsonb,
            '["PRIMARY KEY"]'
        ),
        (
            v_sql_assess_id,
            'What will be the result of evaluating `NULL = NULL` in standard ANSI SQL?',
            'single_mcq',
            'sql',
            NULL,
            NULL,
            '["TRUE", "FALSE", "UNKNOWN (NULL)", "Throws a syntax error"]'::jsonb,
            '["UNKNOWN (NULL)"]'
        ),
        (
            v_sql_assess_id,
            'Look at this window function query. What does `DENSE_RANK()` do when two rows have identical scores?',
            'code_mcq',
            'sql',
            'SELECT student_name, score,' || E'\n' ||
            '       DENSE_RANK() OVER (ORDER BY score DESC) as rank' || E'\n' ||
            'FROM exam_results;',
            'Window Function Evaluation',
            '["Assigns identical ranks and skips the subsequent rank number (e.g., 1, 2, 2, 4)", "Assigns identical ranks without skipping the subsequent rank number (e.g., 1, 2, 2, 3)", "Randomly assigns unique sequential rank numbers", "Throws an error if duplicates exist"]'::jsonb,
            '["Assigns identical ranks without skipping the subsequent rank number (e.g., 1, 2, 2, 3)"]'
        ),
        (
            v_sql_assess_id,
            'Which ACID property ensures that transactions that are committed will survive system crashes and power failures?',
            'single_mcq',
            'sql',
            NULL,
            NULL,
            '["Atomicity", "Consistency", "Isolation", "Durability"]'::jsonb,
            '["Durability"]'
        );
    END IF;

    -- B. Python Assessment
    IF v_python_course_id IS NOT NULL THEN
        SELECT id INTO v_python_assess_id 
        FROM public.assessments 
        WHERE course_id = v_python_course_id AND title ILIKE '%Python Fundamentals%'
        LIMIT 1;

        IF v_python_assess_id IS NULL THEN
            INSERT INTO public.assessments (
                course_id, type, title, description, duration, week_number, day_of_week
            ) VALUES (
                v_python_course_id,
                'weekly',
                'Python Fundamentals & Data Structures Assessment',
                'Comprehensive assessment on Python syntax, mutability, decorators, comprehension, and OOP.',
                30,
                1,
                5
            ) RETURNING id INTO v_python_assess_id;
        END IF;

        -- Seed Questions for Python
        INSERT INTO public.questions (
            assessment_id, question_text, question_type, code_language, code_snippet, snippet_title, options, correct_answer
        ) VALUES
        (
            v_python_assess_id,
            'What is the output of the following Python snippet?',
            'code_mcq',
            'python',
            'def append_to(element, target=[]):' || E'\n' ||
            '    target.append(element)' || E'\n' ||
            '    return target' || E'\n\n' ||
            'print(append_to(1))' || E'\n' ||
            'print(append_to(2))',
            'Default Mutable Arguments',
            '["[1] followed by [2]", "[1] followed by [1, 2]", "[1] followed by [2, 1]", "TypeError: mutable default argument"]'::jsonb,
            '["[1] followed by [1, 2]"]'
        ),
        (
            v_python_assess_id,
            'Which of the following data structures in Python is IMMUTABLE?',
            'single_mcq',
            'python',
            NULL,
            NULL,
            '["List", "Dictionary", "Tuple", "Set"]'::jsonb,
            '["Tuple"]'
        ),
        (
            v_python_assess_id,
            'What will be the output of this dictionary comprehension?',
            'code_mcq',
            'python',
            'keys = ["a", "b", "c"]' || E'\n' ||
            'values = [1, 2, 3]' || E'\n' ||
            'result = {k: v * 2 for k, v in zip(keys, values)}' || E'\n' ||
            'print(result["b"])',
            'Dict Comprehension',
            '["2", "4", "6", "KeyError: ''b''"]'::jsonb,
            '["4"]'
        ),
        (
            v_python_assess_id,
            'What keyword is used in Python to create a generator function that yields values on demand?',
            'single_mcq',
            'python',
            NULL,
            NULL,
            '["return", "yield", "generator", "async"]'::jsonb,
            '["yield"]'
        ),
        (
            v_python_assess_id,
            'What is the time complexity of looking up a key in a standard Python dictionary in the average case?',
            'single_mcq',
            'python',
            NULL,
            NULL,
            '["O(1)", "O(n)", "O(log n)", "O(n log n)"]'::jsonb,
            '["O(1)"]'
        ),
        (
            v_python_assess_id,
            'What does the `*args` and `**kwargs` syntax allow a Python function to accept?',
            'single_mcq',
            'python',
            NULL,
            NULL,
            '["Only keyword arguments and positional arguments with default values", "An arbitrary number of positional arguments (*args) and keyword arguments (**kwargs)", "Pointer arithmetic references to C libraries", "Restricts the function to only accept primitive data types"]'::jsonb,
            '["An arbitrary number of positional arguments (*args) and keyword arguments (**kwargs)"]'
        ),
        (
            v_python_assess_id,
            'What is the output of the following inheritance snippet?',
            'code_mcq',
            'python',
            'class Animal:' || E'\n' ||
            '    def speak(self):' || E'\n' ||
            '        return "Sound"' || E'\n\n' ||
            'class Dog(Animal):' || E'\n' ||
            '    def speak(self):' || E'\n' ||
            '        return "Woof"' || E'\n\n' ||
            'pet = Dog()' || E'\n' ||
            'print(isinstance(pet, Animal), pet.speak())',
            'OOP Polymorphism',
            '["True Woof", "False Woof", "True Sound", "AttributeError"]'::jsonb,
            '["True Woof"]'
        );
    END IF;

    -- C. Full Stack / JavaScript Assessment
    IF v_fullstack_course_id IS NOT NULL THEN
        SELECT id INTO v_fullstack_assess_id 
        FROM public.assessments 
        WHERE course_id = v_fullstack_course_id AND title ILIKE '%Full Stack JavaScript%'
        LIMIT 1;

        IF v_fullstack_assess_id IS NULL THEN
            INSERT INTO public.assessments (
                course_id, type, title, description, duration, week_number, day_of_week
            ) VALUES (
                v_fullstack_course_id,
                'weekly',
                'Full Stack JavaScript & React Architecture',
                'Covers Event Loop, Promise lifecycle, React Hooks, closures, and DOM reconciliation.',
                30,
                1,
                5
            ) RETURNING id INTO v_fullstack_assess_id;
        END IF;

        -- Seed Questions for Full Stack
        INSERT INTO public.questions (
            assessment_id, question_text, question_type, code_language, code_snippet, snippet_title, options, correct_answer
        ) VALUES
        (
            v_fullstack_assess_id,
            'What will be logged to the console in this asynchronous JavaScript snippet?',
            'code_mcq',
            'javascript',
            'console.log("1");' || E'\n' ||
            'setTimeout(() => console.log("2"), 0);' || E'\n' ||
            'Promise.resolve().then(() => console.log("3"));' || E'\n' ||
            'console.log("4");',
            'Event Loop Order of Execution',
            '["1, 2, 3, 4", "1, 4, 2, 3", "1, 4, 3, 2", "3, 1, 4, 2"]'::jsonb,
            '["1, 4, 3, 2"]'
        ),
        (
            v_fullstack_assess_id,
            'What is the primary purpose of the `key` prop in React lists?',
            'single_mcq',
            'javascript',
            NULL,
            NULL,
            '["It styles list items with unique CSS selectors", "It provides a stable identity so React diffing can identify which items changed, added, or removed without re-rendering the whole list", "It binds the item to local storage automatically", "It prevents memory leaks by cleaning up unmounted DOM event listeners"]'::jsonb,
            '["It provides a stable identity so React diffing can identify which items changed, added, or removed without re-rendering the whole list"]'
        ),
        (
            v_fullstack_assess_id,
            'What will the following JavaScript closure code output?',
            'code_mcq',
            'javascript',
            'function makeCounter() {' || E'\n' ||
            '    let count = 0;' || E'\n' ||
            '    return () => ++count;' || E'\n' ||
            '}' || E'\n' ||
            'const counter1 = makeCounter();' || E'\n' ||
            'const counter2 = makeCounter();' || E'\n' ||
            'counter1();' || E'\n' ||
            'console.log(counter1(), counter2());',
            'Closures & Lexical Scope',
            '["2 1", "2 2", "1 1", "3 1"]'::jsonb,
            '["2 1"]'
        ),
        (
            v_fullstack_assess_id,
            'Which React hook is specifically intended to memoize expensive computations between renders?',
            'single_mcq',
            'javascript',
            NULL,
            NULL,
            '["useCallback", "useMemo", "useRef", "useEffect"]'::jsonb,
            '["useMemo"]'
        ),
        (
            v_fullstack_assess_id,
            'What is the key security advantage of setting `httpOnly: true` on an authentication session cookie?',
            'single_mcq',
            'javascript',
            NULL,
            NULL,
            '["It protects the cookie from being accessed by client-side JavaScript, preventing token theft via XSS attacks", "It automatically encrypts the payload with TLS 1.3", "It bypasses Cross-Origin Resource Sharing (CORS) preflight checks", "It prevents the cookie from being sent over HTTPS connections"]'::jsonb,
            '["It protects the cookie from being accessed by client-side JavaScript, preventing token theft via XSS attacks"]'
        ),
        (
            v_fullstack_assess_id,
            'What will be the output of `typeof NaN` in JavaScript?',
            'single_mcq',
            'javascript',
            NULL,
            NULL,
            '["\"number\"", "\"nan\"", "\"undefined\"", "\"object\""]'::jsonb,
            '["\"number\""]'
        );
    END IF;

    RAISE NOTICE 'Successfully seeded assessment test questions!';
END $$;

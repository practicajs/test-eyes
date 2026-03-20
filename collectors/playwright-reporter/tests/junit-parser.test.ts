import { describe, it, expect } from 'vitest'
import { parseJUnitXml } from '../src/junit-parser.js'

describe('parseJUnitXml', () => {
  it('should parse simple test case', () => {
    const xml = `
      <testsuites>
        <testsuite name="suite1">
          <testcase name="test1" classname="MyClass" time="0.5"/>
        </testsuite>
      </testsuites>
    `

    const results = parseJUnitXml(xml)

    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('MyClass test1')
    expect(results[0].durationMs).toBe(500)
    expect(results[0].status).toBe('passed')
  })

  it('should parse failed test', () => {
    const xml = `
      <testsuites>
        <testsuite name="suite1">
          <testcase name="failing-test" classname="MyClass" time="1.0">
            <failure message="Expected true but got false"/>
          </testcase>
        </testsuite>
      </testsuites>
    `

    const results = parseJUnitXml(xml)

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('failed')
  })

  it('should parse skipped test', () => {
    const xml = `
      <testsuites>
        <testsuite name="suite1">
          <testcase name="skipped-test" classname="MyClass" time="0">
            <skipped/>
          </testcase>
        </testsuite>
      </testsuites>
    `

    const results = parseJUnitXml(xml)

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('skipped')
  })

  it('should parse test with error', () => {
    const xml = `
      <testsuites>
        <testsuite name="suite1">
          <testcase name="error-test" classname="MyClass" time="0.1">
            <error message="Unexpected error"/>
          </testcase>
        </testsuite>
      </testsuites>
    `

    const results = parseJUnitXml(xml)

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('failed')
  })

  it('should parse multiple test cases', () => {
    const xml = `
      <testsuites>
        <testsuite name="suite1">
          <testcase name="test1" classname="Class1" time="0.1"/>
          <testcase name="test2" classname="Class1" time="0.2"/>
        </testsuite>
        <testsuite name="suite2">
          <testcase name="test3" classname="Class2" time="0.3"/>
        </testsuite>
      </testsuites>
    `

    const results = parseJUnitXml(xml)

    expect(results).toHaveLength(3)
    expect(results[0].name).toBe('Class1 test1')
    expect(results[1].name).toBe('Class1 test2')
    expect(results[2].name).toBe('Class2 test3')
  })

  it('should handle test without classname', () => {
    const xml = `
      <testsuite>
        <testcase name="standalone-test" time="0.5"/>
      </testsuite>
    `

    const results = parseJUnitXml(xml)

    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('standalone-test')
  })

  it('should handle self-closing testcase', () => {
    const xml = '<testcase name="quick-test" time="0.01"/>'

    const results = parseJUnitXml(xml)

    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('quick-test')
    expect(results[0].durationMs).toBe(10)
  })
})

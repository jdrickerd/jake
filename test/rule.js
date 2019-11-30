let assert = require('assert');
let exec = require('child_process').execSync;
let fs = require('fs');
let Matcher = require('../lib/rule').Matcher;
let utils = require('utilities');

let cleanUpAndNext = function (callback) {
  // Gotta add globbing to file utils rmRf
  let tmpFiles = [
    'tmp'
    , 'tmp_ns'
    , 'tmp_cr'
    , 'tmp_p'
    , 'tmp_pf'
    , 'tmpbin'
    , 'tmpsrc'
    , 'tmp_dep1.c'
    , 'tmp_dep1.o'
    , 'tmp_dep1.oo'
    , 'tmp_dep2.c'
    , 'tmp_dep2.o'
    , 'tmp_dep2.oo'
    , 'foo'
    , 'foo.html'
  ];
  tmpFiles.forEach(function (f) {
    utils.file.rmRf(f, {
      silent: true
    });
  });
  callback && callback();
};

suite('rule', function () {

  this.timeout(5000);

  setup(function (next) {
    process.chdir('./test');
    cleanUpAndNext(next);
  });

  teardown(function () {
    process.chdir('../');
  });

  //  - name   foo:bin/main.o
  //  - pattern    bin/%.o
  //  - source    src/%.c
  //
  // return {
  //    'dep' : 'foo:src/main.c',
  //    'file': 'src/main.c'
  //  };
  test('Matcher.getSource', function () {
    let src = Matcher.getSource('foo:bin/main.o', 'bin/%.o', 'src/%.c');
    assert.equal('foo:src/main.c', src);
  });

  test('rule w/o pattern', function () {
    let out = exec( '../bin/cli.js -q  tmp').toString().trim();
    let output = [
      "tmp_dep2.c task"
      , "tmp_dep1.c task"
      , "cp tmp_dep1.c tmp_dep1.o task"
      , "cp tmp_dep2.c tmp_dep2.o task"
      , "tmp task"];
    assert.equal( output.join('\n'), out);
    let data = fs.readFileSync(process.cwd() + '/tmp');
    assert.equal('src_1src_2', data.toString());
    cleanUpAndNext();
  });

  test('rule w pattern w/o folder w/o namespace', function () {
    let out = exec( '../bin/cli.js  -q  tmp_p').toString().trim();
    let output = [
      "tmp_dep2.c task"
      , "tmp_dep1.c task"
      , "cp tmp_dep1.c tmp_dep1.oo task"
      , "cp tmp_dep2.c tmp_dep2.oo task"
      , "tmp pattern task"];
    let data;
    assert.equal( output.join('\n'), out);
    data = fs.readFileSync(process.cwd() + '/tmp_p');
    assert.equal('src_1src_2 pattern', data.toString());
    cleanUpAndNext();
  });

  test('rule w pattern w folder w/o namespace', function () {
    let out = exec( '../bin/cli.js  -q  tmp_pf').toString().trim();
    let output = [
      "tmpsrc/tmp_dep1.c task"
      , "cp tmpsrc/tmp_dep1.c tmpbin/tmp_dep1.oo task"
      , "tmpsrc/tmp_dep2.c task"
      , "cp tmpsrc/tmp_dep2.c tmpbin/tmp_dep2.oo task"
      , "tmp pattern folder task"];
    let data;
    assert.equal( output.join('\n'), out);
    data = fs.readFileSync(process.cwd() + '/tmp_pf');
    assert.equal('src/src_1src/src_2 pattern folder', data.toString());
    cleanUpAndNext();
  });

  /*
  test('rule w pattern w folder w namespace', function () {
    let out = exec( '../bin/cli.js -q   tmp_ns').toString().trim();
    let output = [
      "tmpsrc/file2.c init task" // yes
      , "tmpsrc/tmp_dep2.c task" // no
      , "cp tmpsrc/tmp_dep2.c tmpbin/tmp_dep2.oo task" // no
      , "tmpsrc/dep1.c task" // no
      , "cp tmpsrc/dep1.c tmpbin/dep1.oo ns task" // no
      , "cp tmpsrc/file2.c tmpbin/file2.oo ns task" // yes
      , "tmp pattern folder namespace task"]; // yes
    let data;
    assert.equal( output.join('\n'), out);
    data = fs.readFileSync(process.cwd() + '/tmp_ns');
    assert.equal('src/src_1src/src_2src/src_3 pattern folder namespace', data.toString());
    cleanUpAndNext();
  });
  */

  test('rule w chain w pattern w folder w namespace', function () {
    let out = exec( '../bin/cli.js -q   tmp_cr').toString().trim();
    let output = [
      "chainrule init task"
      , "cp tmpsrc/file1.tex tmpbin/file1.dvi tex->dvi task"
      , "cp tmpbin/file1.dvi tmpbin/file1.pdf dvi->pdf task"
      , "cp tmpsrc/file2.tex tmpbin/file2.dvi tex->dvi task"
      , "cp tmpbin/file2.dvi tmpbin/file2.pdf dvi->pdf task"
      , "tmp chainrule namespace task"];
    let data;
    assert.equal( output.join('\n'), out);
    data = fs.readFileSync(process.cwd() + '/tmp_cr');
    assert.equal('tex1 tex2  chainrule namespace', data.toString());
    cleanUpAndNext();
  });


  ['precedence', 'regexPattern', 'sourceFunction'].forEach(function (key) {

    test('rule with source file not created yet (' + key  + ')', function () {
      let write = process.stderr.write;
      process.stderr.write = () => {};
      utils.file.rmRf('foo.txt', {silent: true});
      utils.file.rmRf('foo.html', {silent: true});
      try {
        exec('../bin/cli.js  ' + key + ':test');
      }
      catch(err) {
        // foo.txt prereq doesn't exist yet
        assert.ok(err.message.indexOf('Unknown task "foo.html"') > -1);
      }
      process.stderr.write = write;
    });

    test('rule with source file now created (' + key  + ')', function () {
      fs.writeFileSync('foo.txt', '');
      let out = exec('../bin/cli.js -q  ' + key + ':test').toString().trim();
      // Should run prereq and test task
      let output = [
        'created html'
        , 'ran test'
      ];
      assert.equal(output.join('\n'), out);
    });

    test('rule with source file modified (' + key  + ')', function (next) {
      setTimeout(function () {
        fs.writeFileSync('foo.txt', '');
        let out = exec('../bin/cli.js -q  ' + key + ':test').toString().trim();
        // Should again run both prereq and test task
        let output = [
          'created html'
          , 'ran test'
        ];
        assert.equal(output.join('\n'), out);
        //next();
        cleanUpAndNext(next);
      }, 1000); // Wait to do the touch to ensure mod-time is different
    });

    test('rule with existing objective file and no source ' +
        ' (should be normal file-task) (' + key  + ')', function () {
      // Remove just the source file
      fs.writeFileSync('foo.html', '');
      utils.file.rmRf('foo.txt', {silent: true});
      let out = exec('../bin/cli.js -q  ' + key + ':test').toString().trim();
      // Should treat existing objective file as plain file-task,
      // and just run test-task
      let output = [
        'ran test'
      ];
      assert.equal(output.join('\n'), out);
      cleanUpAndNext();
    });

  });

});



program symemorizer;

//===================================================================
// Help to memorize the East Cree syllabics by displaying them at
// random.
//===================================================================

{$mode objfpc}


//===================================================================
// Uses
//===================================================================

uses
	BrowserConsole,
	Classes,
	JS,
	Math,
	Strutils,
	SysUtils,
	Types,
	Web;

//===================================================================
// Types
//===================================================================

Type

  TSlabixApp = class
    function    DoActivity          (aEvent : TEventListenerEvent) : boolean;
    function	DoQuestionOrder		(aEvent : TEventListenerEvent) : boolean;
    function	DoAnswerMakeup		(aEvent : TEventListenerEvent) : boolean;
    function	DoDefinition		(aEvent : TEventListenerEvent) : boolean;
    function	DoChartText 		(aEvent : TEventListenerEvent) : boolean;
    function	DoHelp  			(aEvent : TJSMouseEvent)       : boolean;
    function	DoNoHelp  			(aEvent : TJSMouseEvent)       : boolean;
    function	DoSyNext			(aEvent : TJSMouseEvent)       : boolean;
    function    DoWordNext          (aEvent : TJSMouseEvent)       : boolean;
    function    DoConvert           (aEvent : TJSMouseEvent)       : boolean;
  private
    procedure	Run;
  end;
  
//===================================================================
// Constants
//===================================================================

Const
  
//===================================================================
// Variables
//===================================================================

Var

  Activity               : string;
  
  Convertimagemax        : smallint = 33; {maybe boost this later}
      
  Currentcol             : smallint;
  Currentrow             : smallint;
  
  Givetext               : boolean = True;
  Givevoice              : boolean = True;
  
  Qorder                 : string = 'random';

  Showdefinition         : boolean = True;
  Showcharttext          : boolean = True;
    
  Sycount                : smallint;							               
  Sylist                 : string =
  							  ' a   aa   *     u   uu   e   *    i   ii   (u) h   $'
  							+ ' wa  *    waa   wu  wuu  *   we   wi  wii  *   *   $'
  							+ ' pa  paa  pwaa  pu  puu  pe  pwe  pi  pii  p   *   $'
  							+ ' va  vaa  vwaa  vu  vuu  ve  vwe  vi  vii  v   *   $'
  							+ ' ta  taa  twaa  tu  tuu  te  twe  ti  tii  t   *   $'
  							+ ' tha thaa thwaa thu thuu the thwe thi thii th  *   $'
  							+ ' ka  kaa  kwaa  ku  kuu  ke  kwe  ki  kii  k   kw  $'
  							+ ' cha chaa chwaa chu chuu che chwe chi chii ch  *   $'
  							+ ' ma  maa  mwaa  mu  muu  me  mwe  mi  mii  m   mw  $'
  							+ ' na  naa  nwaa  nu  nuu  ne  nwe  ni  nii  n   *   $'
  							+ ' la  laa  lwaa  lu  luu  le  lwe  li  lii  l   *   $'
  							+ ' sa  saa  swaa  su  suu  se  swe  si  sii  s   *   $'
  							+ ' sha shaa shwaa shu shuu she shwe shi shii sh  *   $'
  							+ ' ya  yaa  ywaa  yu  yuu  ye  ywe  yi  yii  y   *   $'
  							+ ' ra  raa  rwaa  ru  ruu  re  rwe  ri  rii  r   *   $'
  							; 
 
  Sytable                : array [1 .. 20, 1 .. 20] of string;
  Syrowcount             : smallint = 15;
  Sycolcount             : smallint = 11; 
  
  Synames                : array [1 .. 200] of string;
  Syanswer               : string;
  Sybuttonmode           : string;
  
  Wordcount              : smallint; 
                             
  Wordlist               : string =
                              'kaakw                porcupine            $'
                            + 'aahchikw             seal                 $'
                            + 'chiishikw            sky                  $'
                            + 'muuhkumaan           knife                $'
                            + 'pachuuyaan           shirt                $'
                            + 'amiskw               beaver               $'
                            + 'waaskaahiikan        house                $'
                            + 'waashtenimaakan      lamp                 $'
                            + 'niihtaahch           below                $'
                            + 'shiipaa              under                $'
                            + 'nishtu               three                $'
                            + 'mitaaht              ten                  $'
                            + 'miskaat              leg                  $'
                            + 'niipiish             flower               $'
                            + 'taahkaapihchenikan   telephone            $'
                            + 'chiichiish           baby                 $'
                            + 'shikaakw             skunk                $'
                            + 'chiishikaaupiisim    sun                  $'
                            + 'tipiskaaupiisim      moon                 $'
                            + 'achahkush            star                 $'
                            + 'miskut               nose                 $'
                            + 'mitihchii            hand                 $'
                            + 'mwaakw               loon                 $'
                            + 'kaahkaachuu          raven                $'
                            + 'paatimaah            soon                 $'
                            + 'nisk                 Canada goose         $'
                            + 'asaam                snowshoe             $'
                            + 'ushkui               birch tree           $'
                            ;

  Wordimagemax           : smallint = 11;
                             
  Wordnames              : array [1 .. 100] of string;
  Worddefs               : array [1 .. 100] of string;                           
  
  Wordanswer             : string;  
  Worddefinition         : string;                      
  Wordbuttonmode         : string;
  
  Wordsycount            : smallint;
  Wordsycountmax         : smallint = 75;
  Wordsy                 : array [1 .. 75] of string;
                             

//###################################################################
// GENERAL PROCEDURES
//###################################################################


//===================================================================
// Extract the names of each syllabic from the long string and make
// an array of them for selecting at random. Also, put them into a
// table for selecting by row or column. The '*' denotes an empty
// spot. The '$' denotes the end of the row.
//===================================================================

procedure ParseSyllabicList;

var 
  colcount               : smallint;
  currpos                : smallint;
  element                : string;
  elementstart           : smallint;
  elementend             : smallint;
  foundelementstart      : boolean;
  foundelementend        : boolean;
  rowcount               : smallint;
  listlength             : smallint;
  donelist               : boolean;
                      
begin

    // --------------------------------------------------------------
    // Add a trailing ' ' if necessary, and get the length.
    // --------------------------------------------------------------
  
  if rightstr (Sylist, 1) <> ' ' then begin
    Sylist := Sylist + ' ';
  end;
  listlength := length (Sylist);  

    // --------------------------------------------------------------
    // Go up the whole list, extracting elements separated by
    // one or more spaces. 
    // --------------------------------------------------------------

  Sycount := 0;    
  currpos := 0;
  rowcount := 1;
  colcount := 0;
  donelist := False;
	
  repeat
  
      // ------------------------------------------------------------
      // Find the start of the next syllabic name in the big string.
      // ------------------------------------------------------------
    
    foundelementstart := False;
    
    repeat
    
      currpos := currpos + 1;
      if currpos > listlength then begin
        foundelementstart := True;
        donelist := True;
        continue;
      end;
      
      if midstr (Sylist, currpos, 1) <> ' ' then begin
        foundelementstart := True;
      end;
    
    until foundelementstart;

      // ------------------------------------------------------------
      // Maybe we didn't actually find the element start, because we
      // are at the end of the list.
      // ------------------------------------------------------------
    
    if donelist = True then begin
      continue;
    end;

      // ------------------------------------------------------------
      // We did find the start of an element.
      // Find its end - usually another space, but it could also be
      // the end of the list.
      // ------------------------------------------------------------

    elementstart := currpos;
    foundelementend := False;
    
   repeat
    
      currpos := currpos + 1;
      if currpos > listlength then begin
        elementend := currpos - 1;
        foundelementend := True;
        continue;
      end;
      
      if midstr (Sylist, currpos, 1) = ' ' then begin
        elementend := currpos - 1;
        foundelementend := True;
        continue;
      end;     
     
    until foundelementend;
    
      // ------------------------------------------------------------
      // Is it the special element '$' marking the end of a row?
      // ------------------------------------------------------------
    
    element := midstr (Sylist, elementstart, elementend - (elementstart-1));
    
    if element = '$' then begin
      rowcount := rowcount + 1;
      colcount := 0;
      continue;
    end;
    
      // ------------------------------------------------------------
      // Save the element in the table.
      // ------------------------------------------------------------

    colcount := colcount + 1;
    Sytable[rowcount,colcount] := element;
          
      // ------------------------------------------------------------
      // Save the element in our list - unless it's placeholder '*'.
      // ------------------------------------------------------------

    if element <> '*' then begin       
      Sycount := Sycount + 1;
      Synames[Sycount] := element;     
	end;
	
  until donelist;

    // -------------------------------------------------------------
    // If the very last element of all was a row-ending '$' (as it
    // should have been), then we need to roll back the row count
    // by 1, because we increased it in anticipation of getting
    // the next row. (Actually, it doesn't matter since we are not
    // using this to get final count of rows - we hardcoded that.)
    // -------------------------------------------------------------
    
  if element = '$' then begin
    rowcount := rowcount - 1;
  end;
  
end;


//===================================================================
// Extract the words and meanings from the long word string and make
// an array of them.
//
// For simplicity's sake, we assume our list is well-formed, i.e.
// "word somespaces definition more spaces $'
//
// If we replace our program array with a file then we will edit a
// little better.
//===================================================================

procedure ParseWordList;

var 
  currpos                : smallint;
  dollarpos              : smallint;
  donelist               : boolean;
  listlength             : smallint;
  spacepos               : smallint;
  thisdef                : string;
  thispair               : string;
  thisword               : string;
  
                      
begin

  currpos    := 0;
  dollarpos  := 0;
  donelist   := False;
  listlength := length (Wordlist);  
  Wordcount  := 0;    
 
    // --------------------------------------------------------------
    // Go up the whole list, words and definitions separated by '$'.
    // --------------------------------------------------------------
  
  repeat
    
    currpos := dollarpos + 1;
    if currpos > listlength then begin
      donelist := True;
      continue;
    end;
      
    dollarpos := pos ('$', rightstr (Wordlist, listlength - (currpos - 1)));
    if dollarpos = 0 then begin
      donelist := True;
      continue;
    end;
      
    dollarpos := (currpos - 1) + dollarpos;
      
    thispair := trim (midstr (Wordlist, currpos, (dollarpos - 1) - (currpos - 1)));
      
      // Look for space separating word and definition.
      // Since we trimmed it, if we find it then it must be after position 1,
      // and there must be something non-space following it at some point.
      
    spacepos := pos (' ', thispair);
    if spacepos = 0 then begin
      donelist := True;
      continue;
    end;

      // Extract both.
      // No need to trim the word, but the def might have spaces at front.
        
    thisword := leftstr (thispair, spacepos - 1);
    thisdef  := trim (rightstr (thispair, length(thispair) - spacepos));

    Wordcount := Wordcount + 1;
    Wordnames[Wordcount] := thisword;
    Worddefs[Wordcount] := thisdef;              
   
  until donelist;

end;


//===================================================================
// Break a transliterated word into syllables that we can use to
// look up the syllabic characters.
//
// eg break niihtaahch into nii-h-taa-h-ch
//
// We don't really need this routine. We could just manually break
// into syllables all the words we are going to use. And this routine
// isn't 100% reliable because of ambiguities. But we do it anyway
// just for the heck of it. And also to allow the activity where
// they can enter Roman text and have it displayed as syllabics - 
// their text is their own and not broken up.
//===================================================================

function MakeSyllables (s : string) : string;

var
  
  c                      : smallint;
  checksy                : string;
  count                  : smallint;
  done                   : boolean;
  foundsy                : boolean;
  parsedword             : string;
  processedcount         : smallint;
  r                      : smallint;
  start                  : smallint;
  
begin

  processedcount := 0;
  parsedword     := '';
  done           := False;
  
  repeat
  
    foundsy := False;
    
    for c := Sycolcount downto 1 do begin
    
      for r := Syrowcount downto 1 do begin
      
        checksy := Sytable[r,c];
        count   := length (checksy);
        start   := length (s) - (processedcount + count) + 1;
        
        if midstr (s, start, count) = checksy then begin
          foundsy := True;
          if processedcount > 0 then begin
            checksy := checksy + '-';
          end;
          parsedword := checksy + parsedword;
          processedcount := processedcount + count;
          break;
        end;
      
      end; { for r }
      
      if foundsy = True then begin
        break;
      end;
      
    end; {for c }

      // ----------------------------------------------------------------
      // We finished checking all the columns for a syllable.
      //
      // If we didn't find any match then either it's a non-conforming
      // word or our routine is wrong. Just exit with '*'.
      //
      // If we did, then check to see if we are finished.
      // ----------------------------------------------------------------

    case foundsy of      
      False: begin
        parsedword := '*';
        done := true;
      end;
    
      True: begin
        if processedcount = length (s) then begin
          done := True;
        end;
      end;  
    end;
      
  until done;
  
  MakeSyllables := parsedword;
  
end;


//===================================================================
// Tweak the broken-up-into-syllables word.
//
// First, we cannot distinguish in the spelling between a regular "u"
// and a final "u". Is there some rule that allows us to, or is it
// just on pronunciation of that particular word? It seems "u" used
// as a final is common at the end of a word. Let's make that
// substitution. We call this special "u" as "(o)" for purposes of
// our file names (because we already have a "u" of course).
//
// Secondly, add a dash to the end just to make it regular.
//
// Lastly, make it easier for other routines to access the syllables
// (and not have to repeat a scan for dashes) by putting them in an
// array with a count. We make these global just for simplicity.
//
// We don't make this part of the MakeSyllables routine because we
// don't want to add our program requirements to the hyphenated word.
//===================================================================

procedure TweakSyllables (s : string);

var
  dashpos                : smallint;
  done                   : boolean;
  t                      : string;
    
begin
  
  Wordsycount := 0;
  
  if s = '*' then begin
    exit;  
  end;
  
  if rightstr (s, 2) = '-u' then begin
    t := leftstr (s, length (s) - 1) + '(u)-';
  end
  else begin
    t := s + '-';  
  end;

  done := False;
  repeat
  
    if t = '' then begin
      done := True;
      continue;
    end;
    
    dashpos := pos ('-', t);
    if dashpos = 0 then begin
      done := true;
      continue;
    end;

      // ----------------------------------------------------------------
      // If we already have as many syllables in one word as we can
      // handle (this should never happen) then give no indication that
      // there are more, just stop here.
      // ----------------------------------------------------------------
      
    if Wordsycount = Wordsycountmax then begin
      done := True;
      continue;
    end;
    
    Wordsycount := Wordsycount + 1;
    Wordsy[Wordsycount] := leftstr (t, dashpos-1);
    t := rightstr (t, length(t) - dashpos);
    
  until done;
  
end;


//===================================================================
// Display as syllabics the word chosen for the one word activity.
//===================================================================

procedure DisplayWordTestSyllabics(w : string);

var
  fname                  : string;
  i                      : smallint;
  s                      : string;
  ws                     : string;      {word as syllables}
  
begin

  ws := MakeSyllables (w);
  TweakSyllables (ws);
  
  if Wordsycount = 0 then begin
    exit;
  end;
  
    // ------------------------------------------------------------------
    // Syllable by syllable.  
    // ------------------------------------------------------------------
    
  for i := 1 to Wordsycount do begin
    
      // ----------------------------------------------------------------
      // Check for maximum number of syllables.
      // (We only have so many image slots. If we were using a font, we
      // could just let it go.)
      // ----------------------------------------------------------------
 
    if i >= Wordimagemax then begin
      break;
    end;
    
      // ----------------------------------------------------------------
      // Construct the filename and put it in the appropriate image.
      // ----------------------------------------------------------------
        
    str (i, s);
    fname := 'syimages/sy_' + Wordsy[i] + '.svg';      
    TJSElement(Document.getElementById('wordimage' + s))['src'] := fname;
    
  end;
  
      // ----------------------------------------------------------------
      // Blank out trailing unused images (to erase any previous word).
      // ----------------------------------------------------------------

  for i := Wordsycount + 1 to Wordimagemax do begin
    str (i, s);
    fname := 'syimages/_blank.svg';
    TJSElement(Document.getElementById('wordimage' + s))['src'] := fname;     
  end;
       
end;


//===================================================================
// Display chart.
//===================================================================

procedure DisplayChart;

var
  c                      : smallint;
  cs                     : string;
  fname                  : string;
  r                      : smallint;
  rs                     : string;
  sythis                 : string;
  
begin

    // ------------------------------------------------------------------
    // Go row by row.
    // ------------------------------------------------------------------

  for r := 1 to Syrowcount do begin 
    str (r, rs);
    if r < 10 then begin
      rs := '0' + rs;
    end;
      
    for c := 1 to Sycolcount do begin    
      str (c, cs);
      if c < 10 then begin
        cs := '0' + cs;
      end;

        // --------------------------------------------------------------
        // Display the syllabic.
        // --------------------------------------------------------------
      
      sythis := Sytable[r,c];      
      if sythis = '*' then begin
        sythis := '&nbsp;';
        fname := 'syimages/_blank.svg';
      end
      else begin
        fname := 'syimages/sy_' + sythis + '.svg';
      end;
      
      TJSElement(Document.getElementById('r'  + rs + 'c' + cs))['src'] := fname;

        // --------------------------------------------------------------
        // Display the text.
        // --------------------------------------------------------------
      
      if (r = 1) and (c = 10) then begin     { adjust (u) to u }
        sythis := 'u';
      end;
       
      TJSElement(Document.getElementById('fr' + rs + 'c' + cs)).innerHTML := sythis;     

    end;
  
  end;
  
end;


//===================================================================
//Toggle chart text on/off.
//===================================================================

procedure ToggleChartText;

var
  c                      : smallint;
  cs                     : string;
  r                      : smallint;
  rs                     : string;
  sythis                 : string;

begin

  for r := 1 to Syrowcount do begin 
    str (r, rs);
    if r < 10 then begin
      rs := '0' + rs;
    end;
      
    for c := 1 to Sycolcount do begin    
      str (c, cs);
      if c < 10 then begin
        cs := '0' + cs;
      end;

      case Showcharttext of
      
        True : begin
          sythis := Sytable[r,c];      
          if sythis = '*' then begin
            sythis := '&nbsp;';
          end;          
          if (r = 1) and (c = 10) then begin     { adjust (u) to u }
            sythis := 'u';
          end;             
        end;
        
        False : begin
          sythis := '&nbsp;';        
        end;
      
      end;
       
      TJSElement(Document.getElementById('fr' + rs + 'c' + cs)).innerHTML := sythis;     

    end;
    
  end;
  
end;

//###################################################################
// HTML PROCEDURES
//###################################################################


//===================================================================
// Select the activity.
// Prepare the grid.
//===================================================================

function TSlabixApp.DoActivity(aEvent : TEventListenerEvent) : boolean;

var
  x                      : TJSElement;
    
begin

    // ------------------------------------------------------------------
    // Hide the previous activity.
    //
    // First, hide the 'x' no help button in case it was there.
    // And the help button too because not every activity neds it.
    // ------------------------------------------------------------------

  TJSElement(Document.getElementById('divnohelpbutton')).setattribute('hidden', '');
  TJSElement(Document.getElementById('divhelpbutton')).setattribute('hidden', '');

  case Activity of
  
    'welcome' : begin
      TJSElement(Document.getElementById('divwelcome')).setattribute('hidden', '');
    end;
    
    'pleasechoose' : begin
    end;
    
    'chart' : begin
      TJSElement(Document.getElementById('divchart')).setattribute('hidden', '');    
      TJSElement(Document.getElementById('divcharttext')).setattribute('hidden', '');            
      TJSElement(Document.getElementById('divhelpchart')).setattribute('hidden', '');
    end;
    
    'onesyllabic' : begin
      TJSElement(Document.getElementById('divsyllabic')).setattribute('hidden', '');
      TJSElement(Document.getElementById('divquestionorder')).setattribute('hidden', '');
      TJSElement(Document.getElementById('divanswermakeup')).setattribute('hidden', '');            
      TJSElement(Document.getElementById('divhelponesyllabic')).setattribute('hidden', '');
    end;
    
    'oneword' : begin
      TJSElement(Document.getElementById('divword')).setattribute('hidden', '');
      TJSElement(Document.getElementById('divanswermakeup')).setattribute('hidden', '');            
      TJSElement(Document.getElementById('divdefinition')).setattribute('hidden', '');            
      TJSElement(Document.getElementById('divhelponeword')).setattribute('hidden', '');
    end;
    
    'convert' : begin
      TJSElement(Document.getElementById('divconvert')).setattribute('hidden', '');
      TJSElement(Document.getElementById('divhelpconvert')).setattribute('hidden', '');
    end;
    
    'about' : begin
      TJSElement(Document.getElementById('divabout')).setattribute('hidden', '');        
    end;
    
  end;

    // ------------------------------------------------------------------
    // Prepare the current activity.
    // ------------------------------------------------------------------
    
  Activity := TJSHTMLSelectElement(Document.getElementById('selactivity')).value;
  
  case Activity of

    'pleasechoose' : begin
    end;
    
    'chart' : begin
      TJSElement(Document.getElementById('divchart')).removeattribute('hidden');
      TJSElement(Document.getElementById('divcharttext')).removeattribute('hidden');
      TJSElement(Document.getElementById('divhelpbutton')).removeattribute('hidden');
      DisplayChart;
    end;
        
    'onesyllabic' : begin
      TJSElement(Document.getElementById('divsyllabic')).removeattribute('hidden');              
      TJSElement(Document.getElementById('divquestionorder')).removeattribute('hidden');
      TJSElement(Document.getElementById('divanswermakeup')).removeattribute('hidden');     
      TJSElement(Document.getElementById('divhelpbutton')).removeattribute('hidden');
      Sybuttonmode := 'next';
      Syanswer     := ''; { So we have something to compare when checking for repeats first time. }
      TJSElement(Document.getElementById('syllabicimage'))['src'] := 'syimages/_blank.svg';
      TJSElement(Document.getElementById('syllabictext')).innerHTML := '&nbsp;';
      TJSElement(Document.getElementById('butNext')).innerHTML  := '<code>' + 'Next' + '</code>';
    end;
    
    'oneword' : begin
      TJSElement(Document.getElementById('divword')).removeattribute('hidden');
      TJSElement(Document.getElementById('divanswermakeup')).removeattribute('hidden');
      TJSElement(Document.getElementById('divdefinition')).removeattribute('hidden');
      TJSElement(Document.getElementById('divhelpbutton')).removeattribute('hidden');
      Wordanswer := '';
      Worddefinition := '';
    end;
    
    'convert' : begin
      TJSElement(Document.getElementById('divconvert')).removeattribute('hidden');
      TJSElement(Document.getElementById('divhelpbutton')).removeattribute('hidden');
      TJSHTMLTextAreaElement(Document.getElementById('convtext')).value := '';    
     end;
    
    'about' : begin    
      TJSElement(Document.getElementById('divabout')).removeattribute('hidden');
    end;
    
  end;

end;


//===================================================================
// They want to change the order in which the syllabics are presented
// for questioning.
//===================================================================

function TSlabixApp.DoQuestionOrder(aEvent : TEventListenerEvent) : boolean;

var
  v                     : string = '*';
  
begin

  v := TJSHTMLSelectElement(Document.getElementById('selquestionorder')).value;
   
  case v of
    'random' : begin
      Qorder := 'random';
    end;
    'firstsound' : begin
      Qorder := 'firstsound';
      Currentrow := 1;
      Currentcol := 0;
    end;
    'lastsound' : begin
      Qorder := 'lastsound';
      Currentrow := 0;
      Currentcol := 1;
    end;
    else begin
      Qorder := 'random';
    end;
  end;
 
end;


//===================================================================
// They want to change whether text or voice or both or neither
// are given in the answer.
//===================================================================

function TSlabixApp.DoAnswerMakeup(aEvent : TEventListenerEvent) : boolean;

var
  v                     : string = '*';
  
begin

  v := TJSHTMLSelectElement(Document.getElementById('selanswermakeup')).value;
   
  case v of
    'text' : begin
      Givetext  := True;
      Givevoice := False;
    end;
    'voice' : begin
      GiveText  := False;
      Givevoice := True;
    end;
    'textandvoice' : begin
      Givetext  := True;
      Givevoice := True
    end;
    else begin
      Givetext  := False;
      Givevoice := False;
    end;
  end;
 
end;


//===================================================================
// They want to change whether definitions are given for a word.
//===================================================================

function TSlabixApp.DoDefinition(aEvent : TEventListenerEvent) : boolean;

var
  v                     : string = '*';
  
begin

  v := TJSHTMLSelectElement(Document.getElementById('seldefinition')).value;
   
  case v of
    'yes' : begin
      Showdefinition := True;
    end;
    'no' : begin
      Showdefinition := False;
    end;
  end;
 
end;


//===================================================================
// They want to change whether text is given for the chart.
//===================================================================

function TSlabixApp.DoChartText(aEvent : TEventListenerEvent) : boolean;

var
  v                     : string = '*';
  
begin

  v := TJSHTMLSelectElement(Document.getElementById('selcharttext')).value;
   
  case v of
    'yes' : begin
      Showcharttext := True;
      ToggleChartText;
    end;
    'no' : begin
      Showcharttext := False;
      ToggleChartText;
    end;
  end;
 
end;

 
//===================================================================
// They clicked the Help button.
//
// Display the help for this activity.
//===================================================================

function TSlabixApp.DoHelp(aEvent : TJSMouseEvent) : boolean;

begin

  TJSElement(Document.getElementById('divnohelpbutton')).removeattribute('hidden');                    
  TJSElement(Document.getElementById('divhelpbutton')).setattribute('hidden', '');                    

  case Activity of
  
    'welcome' : begin
    end;
    
    'pleasechoose' : begin
    end;
    
    'chart' : begin
      TJSElement(Document.getElementById('divhelpchart')).removeattribute('hidden');                    
    end;
    
    'onesyllabic' : begin
      TJSElement(Document.getElementById('divhelponesyllabic')).removeattribute('hidden');                    
    end;
    
    'oneword' : begin
      TJSElement(Document.getElementById('divhelponeword')).removeattribute('hidden');                    
    end;
    
    'convert' : begin
      TJSElement(Document.getElementById('divhelpconvert')).removeattribute('hidden');                    
    end;
    
    'about' : begin
    
    end;
    
  end;
  
end;
 
//===================================================================
// They clicked the NoHelp button.
//
// Turn off the help for this activity.
//===================================================================

function TSlabixApp.DoNoHelp(aEvent : TJSMouseEvent) : boolean;

begin
  
  TJSElement(Document.getElementById('divnohelpbutton')).setattribute('hidden', '');                    
  TJSElement(Document.getElementById('divhelpbutton')).removeattribute('hidden');                    

  case Activity of
  
    'welcome' : begin
    end;
    
    'pleasechoose' : begin
    end;
    
    'chart' : begin
      TJSElement(Document.getElementById('divhelpchart')).setattribute('hidden', '');                    
    end;
    
    'onesyllabic' : begin
      TJSElement(Document.getElementById('divhelponesyllabic')).setattribute('hidden', '');                    
    end;
    
    'oneword' : begin
      TJSElement(Document.getElementById('divhelponeword')).setattribute('hidden', '');                    
    end;
    
    'convert' : begin
      TJSElement(Document.getElementById('divhelpconvert')).setattribute('hidden', '');                    
    end;
    
    'about' : begin
    
    end;
    
  end;

end;


//===================================================================
// They clicked the Begin/Next/Answer button.
//
// When it says 'Next', we clear out the previous answer and show the
// next syllabic.
//
// When it says 'Answer', we show the text corresponding to the
// syllabic, and/or play its sound.
//===================================================================

function TSlabixApp.DoSyNext(aEvent : TJSMouseEvent) : boolean;

var
  buttontext             : string;
  fname                  : string;
  goodonefound           : boolean;
  n                      : smallint;
  sythis                 : string;
  
begin

  case Sybuttonmode of

      // -----------------------------------------------------------
      // "NEXT": Show the next random syllabic to test,
      // and prepare the answer.
      // -----------------------------------------------------------
        
    'next' : begin
      
        // ---------------------------------------------------------
        // Get the next syllabic.
        // Depends on the order they have chosen: random, first
        // sound (row), or last sound (column).
        // ---------------------------------------------------------
      
      case Qorder of
      
          // -------------------------------------------------------
          // Pick one at random. If it's the same as the one
          // that's currently up there, pick another. (If it's
          // still the same, we won't bother picking another.)
          // -------------------------------------------------------
      
        'random' : begin
          n := random (Sycount) + 1;
          sythis := Synames[n];
      
          if sythis = Syanswer then begin
            n := random (Sycount) + 1;
            sythis := Synames[n];
          end;
      
        end;
        
          // -------------------------------------------------------
          // Pick the next one in this row. If at the end,
          // Start a new row.
          // -------------------------------------------------------
                         
        'firstsound' : begin
                
          goodonefound := False;
          repeat
            Currentcol := Currentcol + 1;
            if Currentcol > Sycolcount then begin
              Currentcol := 1;
              Currentrow := Currentrow + 1;
              if Currentrow > Syrowcount then begin
                Currentrow := 1;
              end;
            end;
            sythis := Sytable[Currentrow, Currentcol];
            if sythis <> '*' then begin
              goodonefound := True;
            end;
          until goodonefound;
          
        end;
        
          // -------------------------------------------------------
          // Pick the next one in this column. If at the end,
          // Start a new column.
          // -------------------------------------------------------
        
        'lastsound' : begin
        
          goodonefound := False;
          repeat
            Currentrow := Currentrow + 1;
            if Currentrow > Syrowcount then begin
              Currentrow := 1;
              Currentcol := Currentcol + 1;
              if Currentcol > Sycolcount then begin
                Currentcol := 1;
              end;
            end;
            sythis := Sytable[Currentrow, Currentcol];
            if sythis <> '*' then begin
              goodonefound := True;
            end;
          until goodonefound;
                  
        end;
        
      end; {case Qorder} 

        // ---------------------------------------------------------
        // Now we have the name of the syllabic.
        // Construct its filename and display the svg syllabic.
        // Blank out the answer area, and save for the answer.
        // ---------------------------------------------------------
             
      fname := 'syimages/sy_' + sythis + '.svg';
      
      TJSElement(Document.getElementById('syllabicimage'))['src'] := fname;
      TJSElement(Document.getElementById('syllabictext')).innerHTML := '&nbsp;';
      Syanswer := sythis;                

        // ---------------------------------------------------------
        // If they don't want to see any answer, then prepare the
        // button to give the next syllabic. Otherwise, prepare it
        // to give the answer.
        // ---------------------------------------------------------

      if (Givetext = False) and (Givevoice = False) then begin
        buttontext := '&nbsp;' + 'Next' + '&nbsp;';
        Sybuttonmode := 'next';
      end
      else begin
        buttontext := 'Answer';
        Sybuttonmode := 'answer';
      end;
             
      TJSElement(Document.getElementById('butNext')).innerHTML  := '<code>' + buttontext + '</code>';
     
    end; 

      // -----------------------------------------------------------
      // "ANSWER": Show the answer.
      // -----------------------------------------------------------
        
    'answer' : begin
   
      if Givetext = True then begin
        TJSElement(Document.getElementById('syllabictext')).innerHTML
          := '&nbsp;&nbsp;&nbsp;&nbsp;' + Syanswer;
      end;
      
      if Givevoice = True then begin
        TJSElement(Document.getElementById('syllabicaudio'))['src']
          := 'sysounds/aud_' + Syanswer + '.ogg';
      end;
      
      TJSElement(Document.getElementById('butNext')).innerHTML
        := '<code>' + '&nbsp;' + 'Next' + '&nbsp;' +'</code>';         
      Sybuttonmode := 'next';
      
    end;
  
  end;
  
end;


//===================================================================
// They clicked the One Word activity Next or Answer button.
//
// When it says 'Next', we clear out the previous answer and show the
// next word in syllabics.
//
// When it says 'Answer', we show the text corresponding to the
// syllabics, and/or play its sound.
//===================================================================

function TSlabixApp.DoWordNext(aEvent : TJSMouseEvent) : boolean;

var
  buttontext             : string;
  n                      : smallint;
  wordthis               : string;
  
begin

  case Wordbuttonmode of

      // -----------------------------------------------------------
      // "NEXT": Show the next random word to test,
      // and prepare the answer.
      // -----------------------------------------------------------
        
    'next' : begin
            
        // -------------------------------------------------------
        // Pick one at random. If it's the same as the one
        // that's currently up there, pick another. (If it's
        // still the same, we won't bother picking another.)
        // -------------------------------------------------------
      
      n := random (Wordcount) + 1;
      wordthis := Wordnames[n];
      
      if wordthis = Wordanswer then begin
        n := random (Wordcount) + 1;
        wordthis := Wordnames[n];
      end;
        // ---------------------------------------------------------
        // Now we have the name of the word.
        // Call the routine that displays this word as syllabics.
        // Blank out the answer area, and save for the answer.
        // ---------------------------------------------------------
             
      DisplayWordTestSyllabics (wordthis);
      
      TJSElement(Document.getElementById('wordtext')).innerHTML := '&nbsp;';
      TJSElement(Document.getElementById('worddefinition')).innerHTML := '&nbsp;';
      Wordanswer := wordthis;
      Worddefinition := Worddefs[n];                

        // ---------------------------------------------------------
        // If they don't want to see any answer, then prepare the
        // button to give the next word. Otherwise, prepare it
        // to give the answer.
        // ---------------------------------------------------------

      if (Givetext = False) and (Givevoice = False) then begin
        buttontext := '<code>' + '&nbsp;' + 'Next' + '&nbsp;' +'</code>';
        Wordbuttonmode := 'next';
      end
      else begin
        buttontext := '<code>' + 'Answer' +'</code>';
        Wordbuttonmode := 'answer';
      end;
             
      TJSElement(Document.getElementById('butWordNext')).innerHTML  := '<code>' + buttontext + '</code>';
     
    end; 

      // -----------------------------------------------------------
      // "ANSWER": Show the answer.
      // -----------------------------------------------------------
        
    'answer' : begin
   
      if Givetext = True then begin
        TJSElement(Document.getElementById('wordtext')).innerHTML
          := '&nbsp;&nbsp;&nbsp;&nbsp;' + Wordanswer;
      end;
      
      if Showdefinition = True then begin
        TJSElement(Document.getElementById('worddefinition')).innerHTML
          := '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + '(' + Worddefinition + ')';
      end;
      
      if Givevoice = True then begin
        TJSElement(Document.getElementById('wordaudio'))['src']
          := 'sywords/' + Wordanswer + '.ogg';
      end;
      
      TJSElement(Document.getElementById('butWordNext')).innerHTML
        := '<code>' + '&nbsp;' + 'Next' + '&nbsp;' +'</code>';         
      Wordbuttonmode := 'next';
      
    end;
  
  end;
  
end;


//===================================================================
// Convert the text area to syllabics.
//
//===================================================================

function TSlabixApp.DoConvert(aEvent : TJSMouseEvent) : boolean;

var
  currpos                : smallint;
  done                   : boolean;
  fname                  : string;
  i                      : smallint;
  imagenum               : smallint;
  listlength             : smallint;
  s                      : string;
  spacepos               : smallint;
  thisword               : string;
  t                      : string;
  v                      : string;
  wc                     : smallint;
  ws                     : string;
  
begin

    // ------------------------------------------------------------------
    // Get the text area and clean it up a bit.
    // Remove leading and trailing spaces.
    // Reduce internal spaces to 1.
    //
    // What to do with punctuation (non-letters)? We *should* handle
    // them and redisplay as part of the syllabics. Failing that, we
    // should remove them up front. And poorest of all, treat them as
    // errors of input. For now, we will just remove them. If we ever
    // changed to using actual font characters as output instead of
    // SVG (so the output could be usefully copied elsewhere), we could
    // handle and retain the punctuation.
    // ------------------------------------------------------------------
 
  v := TJSHTMLTextAreaElement(Document.getElementById('convtext')).value;

  v := lowercase (v);
  
  listlength := length(v);  
  for i := 1 to listlength do begin
    if pos (midstr (v,i,1), 'abcdefghijklmnopqrstuvwxyz') = 0 then begin
      v := leftstr (v, i-1) + ' ' + rightstr (v, listlength-i); 
    end;
  end;
  v := trim (v);
  v := delspace1 (v);
  v := v + ' ';

    // ------------------------------------------------------------------
    // Next word.
    // ------------------------------------------------------------------
  
  listlength := length (v);
  currpos := 0;
  imagenum := 0;
  done := False;
  
  repeat
    
    currpos := currpos + 1;
    if currpos > listlength then begin
      done := True;
      continue;
    end;
    
    spacepos := pos (' ', rightstr (v, listlength - (currpos - 1)));
    if spacepos = 0 then begin
      done := True;
      continue;
    end;  
    
    spacepos := spacepos + (currpos - 1);
    thisword := midstr (v, currpos, (spacepos - 1) - (currpos -1 ));
    currpos := spacepos;

      // ----------------------------------------------------------------
      // Check for bad word.
      // We should probably display an image with '???' or something.
      // ----------------------------------------------------------------
      
    ws := MakeSyllables (thisword);
    Tweaksyllables (ws);
    if Wordsycount = 0 then begin
      continue;
    end;

      // ----------------------------------------------------------------
      // We will only show a complete word.
      // So if there are more syllables in this word than we have images
      // left, we will ignore it (and everything that comes after).
      // ----------------------------------------------------------------

    if imagenum + Wordsycount > Convertimagemax then begin
      done := True;
      continue;
    end;
    
      // ----------------------------------------------------------------
      // Process each syllable in this word.
      // ----------------------------------------------------------------

    for i := 1 to Wordsycount do begin
      imagenum := imagenum + 1;      
      str (imagenum, s);
      fname := 'syimages/sy_' + Wordsy[i] + '.svg';      
      TJSElement(Document.getElementById('convimage' + s))['src'] := fname;    
    end;    

      // ----------------------------------------------------------------
      // Blank between words. (check max too)
      // ----------------------------------------------------------------

    if imagenum < Convertimagemax then begin
      imagenum := imagenum + 1;      
      str (imagenum, s);
      fname := 'syimages/_blank.svg';      
      TJSElement(Document.getElementById('convimage' + s))['src'] := fname;        
    end;
             
  until done;

    // ------------------------------------------------------------------
    // Blank out remaining images.
    // ------------------------------------------------------------------

  for i := imagenum + 1 to Convertimagemax do begin
    str (i, s);
    fname := 'syimages/_blank.svg';
    TJSElement(Document.getElementById('convimage' + s))['src'] := fname;     
  end;
  
end;


//===================================================================
// Generate the HTML elements for the chart.
//
// As opposed to having them type into the HTML file ahead of time.
// Generating them makes the HTML file a little less unwieldy.
//===================================================================

Procedure GenerateChart;

var
  brelem                 : TJSElement;
  capelem                : TJSElement;
  divelem                : TJSElement;
  figelem                : TJSElement;
  imgelem                : TJSElement;

  c                      : smallint;
  cs                     : string;
  r                      : smallint;
  rs                     : string;
  
begin

  divelem := TJSElement(Document.getElementById('divchartimages'));
  brelem  := document.createElement('br');
  
  for r := 1 to Syrowcount do begin
  
    str (r, rs);
    if r < 10 then begin
      rs := '0' + rs;
    end;
        
    for c := 1 to Sycolcount do begin
    
      str (c, cs);
      if c < 10 then begin
        cs := '0' + cs;
      end;
      
      figelem := document.createElement('figure');
  
      divelem.appendChild(figelem);

      imgelem := document.createElement('img');
      capelem := document.createElement('figcaption');
  
      figelem.appendChild(imgelem);
      figelem.appendChild(capelem);
  
      imgelem['id']     := 'r' + rs + 'c' + cs;
      imgelem['src']    := 'syimages/_blank.svg';
      imgelem['width']  := '40';
      imgelem['height'] := '40';
  
      capelem['id']     := 'f' + 'r' + rs + 'c' + cs;
      capelem.innerHTML := '&nbsp;';

    end; {c}

      // ----------------------------------------------------------------
      // Add break between this row and next - even for the last.
      // ----------------------------------------------------------------
      
    brelem := document.createElement('br');
    divelem.appendChild(brelem);
    
  end; {r}

end;


//===================================================================
// Run
//===================================================================

Procedure TSlabixApp.Run;

begin
  TJSHtmlButtonElement(Document.getElementById('butHelp')).OnClick           := @DoHelp;
  TJSHtmlButtonElement(Document.getElementById('butNoHelp')).OnClick         := @DoNoHelp;
  TJSHtmlButtonElement(Document.getElementById('butNext')).OnClick           := @DoSyNext;
  TJSHtmlButtonElement(Document.getElementById('butWordNext')).OnClick       := @DoWordNext;
  TJSHtmlButtonElement(Document.getElementById('butConvert')).OnClick        := @DoConvert;
  TJSHtmlSelectElement(Document.getElementById('selactivity')).OnChange      := @DoActivity;
  TJSHtmlSelectElement(Document.getElementById('selquestionorder')).OnChange := @DoQuestionOrder;
  TJSHtmlSelectElement(Document.getElementById('selanswermakeup')).OnChange  := @DoAnswerMakeup;
  TJSHtmlSelectElement(Document.getElementById('seldefinition')).OnChange    := @DoDefinition;
  TJSHtmlSelectElement(Document.getElementById('selcharttext')).OnChange     := @DoChartText;
  
  GenerateChart;
  
end;


//###################################################################
// Mainline
//###################################################################

begin

  Activity       := 'welcome';
  
  Sybuttonmode   := 'next';		{ Start off picking a random syllabic to show. }
  Syanswer       := '';         { So we have something to compare when checking for repeats first time. }

  Wordbuttonmode := 'next';  
  Wordanswer     := '';
  Worddefinition := '';
  
  ParseSyllabicList;			{ Extract the names of the syllabics from the list. }
  ParseWordList;
  
  With TSlabixApp.Create do
    Run;
    
end.



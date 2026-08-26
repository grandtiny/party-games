package
{
   import com.tencent.qqshow.atfarm.ModelLocator;
   import flash.display.MovieClip;
   import flash.display.SimpleButton;
   import flash.events.Event;
   import flash.events.MouseEvent;
   import flash.text.TextField;

   [Embed(source="/_assets/assets.swf", symbol="symbol75")]
   public class QShow_Step3 extends MovieClip
   {
      public var icon:MovieClip;

      public var ok_btn:SimpleButton;

      public var return_btn:SimpleButton;

      public var toRed_btn:SimpleButton;

      public var error_txt:TextField;

      public function QShow_Step3()
      {
         super();
         addEventListener(Event.ENTER_FRAME,tDelayInit,false,0,true);
      }

      private function returnClickHandler(param1:MouseEvent) : void
      {
         dispatchEvent(new Event("ShowMain"));
      }

      public function gotoMall(param1:MouseEvent) : void
      {
      }

      private function tDelayInit(param1:Event) : void
      {
         removeEventListener(Event.ENTER_FRAME,tDelayInit,false);
         return_btn.visible = true;
         ok_btn.visible = false;
         return_btn.addEventListener(MouseEvent.CLICK,returnClickHandler);
         ok_btn.addEventListener(MouseEvent.CLICK,returnClickHandler);
         toRed_btn.visible = false;
         toRed_btn.mouseEnabled = false;
         var _loc2_:String = ModelLocator.getInstance().errorID.toString();
         error_txt.htmlText = "";
         icon.gotoAndStop(1);
         switch(_loc2_)
         {
            case "0":
               return_btn.visible = false;
               ok_btn.visible = true;
               icon.gotoAndStop(2);
               error_txt.text = "保存成功";
               break;
            case "1":
               error_txt.text = "当前农场形象暂不可用，请返回后重试。";
               break;
            case "2":
               error_txt.text = "农场形象需要农场等级" + ModelLocator.getInstance().greyLevel + "级及以上才可以设置。";
               break;
            case "3":
               return_btn.visible = false;
               ok_btn.visible = true;
               error_txt.text = "网络繁忙，请重试。确定后返回之前页面。";
               break;
            case "4":
               return_btn.visible = false;
               ok_btn.visible = true;
               error_txt.text = "设置农场形象失败，请修改后重新保存。";
               break;
            default:
               throw new ArgumentError("Argument Error.");
         }
      }
   }
}
